"use client";

/**
 * Parametric3DViewer.tsx — Sub-stages 12B + 13B integration
 *
 * Renders an interactive, parametric 3D WebGL model from extracted datasheet
 * CAD parameters.  Built on @react-three/fiber + @react-three/drei.
 *
 * Architecture:
 *  - <Parametric3DViewer>  : public component — accepts extractedSpecs prop
 *  - <SceneContent>        : R3F scene graph (lighting, geometry, shadows)
 *  - <IndustrialPart>      : procedural mesh (body + flanges + port)
 *  - <StressOverlayMesh>   : stress heat-map / rupture jitter layer (13B)
 *  - <StressAnalysisPanel> : floating glassmorphic stress UI (13B)
 *  - <OverlayControls>     : HTML overlay (zoom, rotate, reset, legend)
 *
 * Invariants (per AGENTS.md):
 *  - "use client" directive kept — R3F requires browser canvas APIs.
 *  - No placeholder / stub data.  All geometry is derived from cadMapper output.
 *  - Layer boundaries respected: this file is UI-only; cadMapper/stressSimulator
 *    handle all parsing and physics computation.
 */

import {
  useRef,
  useState,
  useCallback,
  Suspense,
  useMemo,
  useEffect,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Grid,
  Environment,
} from "@react-three/drei";
import * as THREE from "three";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  Cpu,
  Info,
} from "lucide-react";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";

import { extractCADParameters } from "@/utils/cadMapper";
import { calculateStressState } from "@/utils/stressSimulator";
import type { CADParameters, MaterialType } from "@/types/cad";
import { StressOverlayMesh } from "@/components/StressOverlayMesh";
import {
  StressAnalysisPanel,
  useStressPanel,
} from "@/components/StressAnalysisPanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface Parametric3DViewerProps {
  /**
   * Raw spec key/value pairs straight from the extraction pipeline.
   * Pass `{}` to render with safe fallback defaults.
   */
  extractedSpecs: Record<string, string>;
  className?: string;
  externalStressMode?: boolean;
  externalPSI?: number;
  externalTempF?: number;
  onStressModeChange?: (active: boolean) => void;
  onPSIChange?: (psi: number) => void;
  onTempChange?: (tempF: number) => void;
}

// ---------------------------------------------------------------------------
// Material PBR property map
// ---------------------------------------------------------------------------

interface PBRProps {
  color: string;
  metalness: number;
  roughness: number;
  envMapIntensity: number;
}

const MATERIAL_PBR: Record<MaterialType, PBRProps> = {
  stainless_steel: {
    color: "#b0bec5",
    metalness: 0.92,
    roughness: 0.18,
    envMapIntensity: 1.4,
  },
  brass: {
    color: "#c8a84b",
    metalness: 0.85,
    roughness: 0.22,
    envMapIntensity: 1.2,
  },
  cast_iron: {
    color: "#4a4a4a",
    metalness: 0.55,
    roughness: 0.75,
    envMapIntensity: 0.7,
  },
  pvc: {
    color: "#e8e0d0",
    metalness: 0.0,
    roughness: 0.88,
    envMapIntensity: 0.3,
  },
};

// ---------------------------------------------------------------------------
// Scene unit scaling
// ---------------------------------------------------------------------------

/** Scale factor: mm → Three.js units so parts are viewport-friendly. */
const MM_SCALE = 0.012;

/** Convert mm dimension to scene units. */
const s = (mm: number) => mm * MM_SCALE;

// ---------------------------------------------------------------------------
// Procedural industrial part mesh
// ---------------------------------------------------------------------------

interface IndustrialPartProps {
  params: CADParameters;
  /** When true, omit the main body cylinder (StressOverlayMesh renders it). */
  stressMode?: boolean;
}

function IndustrialPart({ params, stressMode = false }: IndustrialPartProps) {
  const groupRef = useRef<THREE.Group>(null!);

  const {
    outerDiameter,
    innerDiameter,
    length,
    flangeDiameter,
    portSize,
    materialType,
  } = params;

  const pbr = MATERIAL_PBR[materialType];

  // Convert all dimensions to scene units
  const outerR = s(outerDiameter / 2);
  const innerR = s(innerDiameter / 2);
  const bodyLen = s(length);
  const flangeR = s(flangeDiameter / 2);
  const portR = s(portSize / 2);

  const flangeThickness = Math.max(s(8), outerR * 0.28);
  const flangeOffset = bodyLen / 2 - flangeThickness / 2;

  // Segment counts — balance quality vs. performance
  const radialSeg = 64;
  const portSeg = 32;

  // Shared material — memoised to avoid per-frame allocations
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: pbr.color,
        metalness: pbr.metalness,
        roughness: pbr.roughness,
        envMapIntensity: pbr.envMapIntensity,
        side: THREE.FrontSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materialType]
  );

  // Hollow bore material (slightly darker / rougher)
  const boreMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(pbr.color).multiplyScalar(0.6).getStyle(),
        metalness: pbr.metalness * 0.7,
        roughness: Math.min(pbr.roughness + 0.2, 1),
        side: THREE.BackSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [materialType]
  );

  return (
    <group ref={groupRef}>
      {/* ── Main hollow body cylinder — hidden in stress mode (StressOverlayMesh owns it) */}
      {!stressMode && (
        <mesh material={material} castShadow receiveShadow>
          <cylinderGeometry
            args={[outerR, outerR, bodyLen, radialSeg, 1, false]}
          />
        </mesh>
      )}

      {/* ── Inner bore — hidden in stress mode (StressOverlayMesh renders its own bore) */}
      {!stressMode && (
        <mesh material={boreMaterial}>
          <cylinderGeometry
            args={[innerR, innerR, bodyLen, radialSeg, 1, true]}
          />
        </mesh>
      )}

      {/* ── Top end-cap ring (annular washer) ──────────────────────────── */}
      <mesh material={material} position={[0, bodyLen / 2, 0]} castShadow>
        <ringGeometry args={[innerR, outerR, radialSeg]} />
        <meshStandardMaterial
          color={pbr.color}
          metalness={pbr.metalness}
          roughness={pbr.roughness}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Bottom end-cap ring ─────────────────────────────────────────── */}
      <mesh
        material={material}
        position={[0, -bodyLen / 2, 0]}
        rotation={[Math.PI, 0, 0]}
        castShadow
      >
        <ringGeometry args={[innerR, outerR, radialSeg]} />
        <meshStandardMaterial
          color={pbr.color}
          metalness={pbr.metalness}
          roughness={pbr.roughness}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Mounting flange — top ───────────────────────────────────────── */}
      <Flange
        radius={flangeR}
        innerRadius={outerR}
        thickness={flangeThickness}
        yPos={flangeOffset}
        material={material}
        radialSeg={radialSeg}
      />

      {/* ── Mounting flange — bottom ─────────────────────────────────────── */}
      <Flange
        radius={flangeR}
        innerRadius={outerR}
        thickness={flangeThickness}
        yPos={-flangeOffset}
        material={material}
        radialSeg={radialSeg}
      />

      {/* ── Bolt holes on top flange ─────────────────────────────────────── */}
      <BoltPattern
        flangeRadius={flangeR}
        outerBodyRadius={outerR}
        yPos={flangeOffset}
        material={material}
      />

      {/* ── Bolt holes on bottom flange ──────────────────────────────────── */}
      <BoltPattern
        flangeRadius={flangeR}
        outerBodyRadius={outerR}
        yPos={-flangeOffset}
        material={material}
      />

      {/* ── Centre port / valve extrusion (side-mounted nozzle) ──────────── */}
      <CentrePort
        portRadius={portR}
        bodyRadius={outerR}
        material={material}
        portSeg={portSeg}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Sub-geometries
// ---------------------------------------------------------------------------

interface FlangeProps {
  radius: number;
  innerRadius: number;
  thickness: number;
  yPos: number;
  material: THREE.MeshStandardMaterial;
  radialSeg: number;
}

function Flange({
  radius,
  innerRadius,
  thickness,
  yPos,
  material,
  radialSeg,
}: FlangeProps) {
  return (
    <group position={[0, yPos, 0]}>
      {/* Flange disc (solid ring) */}
      <mesh material={material} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, thickness, radialSeg]} />
      </mesh>
      {/* Bored through-hole matching body bore */}
      <mesh>
        <cylinderGeometry args={[innerRadius, innerRadius, thickness + 0.001, radialSeg, 1, true]} />
        <meshStandardMaterial
          color={material.color}
          metalness={material.metalness * 0.7}
          roughness={Math.min(material.roughness + 0.15, 1)}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

interface BoltPatternProps {
  flangeRadius: number;
  outerBodyRadius: number;
  yPos: number;
  material: THREE.MeshStandardMaterial;
}

const BOLT_COUNT = 8;
const BOLT_HOLE_R_RATIO = 0.065; // bolt hole radius as fraction of flange radius

function BoltPattern({
  flangeRadius,
  outerBodyRadius,
  yPos,
  material,
}: BoltPatternProps) {
  const boltCircleR = (flangeRadius + outerBodyRadius) / 2;
  const boltHoleR = flangeRadius * BOLT_HOLE_R_RATIO;
  const boltDepth = flangeRadius * 0.32;

  return (
    <group position={[0, yPos, 0]}>
      {Array.from({ length: BOLT_COUNT }).map((_, i) => {
        const angle = (i / BOLT_COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * boltCircleR;
        const z = Math.sin(angle) * boltCircleR;
        return (
          <mesh
            key={i}
            position={[x, 0, z]}
            material={material}
            castShadow
          >
            <cylinderGeometry args={[boltHoleR, boltHoleR, boltDepth, 12]} />
          </mesh>
        );
      })}
    </group>
  );
}

interface CentrePortProps {
  portRadius: number;
  bodyRadius: number;
  material: THREE.MeshStandardMaterial;
  portSeg: number;
}

function CentrePort({
  portRadius,
  bodyRadius,
  material,
  portSeg,
}: CentrePortProps) {
  // Nozzle extends from the body surface outward by 1.5× port radius
  const nozzleLength = portRadius * 2.5;
  const nozzleOffset = bodyRadius + nozzleLength / 2;

  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* Nozzle stem */}
      <mesh
        position={[nozzleOffset, 0, 0]}
        material={material}
        castShadow
      >
        <cylinderGeometry
          args={[portRadius * 1.2, portRadius * 1.2, nozzleLength, portSeg]}
        />
      </mesh>
      {/* Nozzle tip collar */}
      <mesh
        position={[nozzleOffset + nozzleLength / 2, 0, 0]}
        material={material}
        castShadow
      >
        <cylinderGeometry
          args={[portRadius * 1.55, portRadius * 1.55, portRadius * 0.5, portSeg]}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera reset helper (must live inside Canvas context)
// ---------------------------------------------------------------------------

interface CameraControllerProps {
  controlsRef: React.RefObject<OrbitControlsType | null>;
  autoRotate: boolean;
}

function CameraController({ controlsRef, autoRotate }: CameraControllerProps) {
  return (
    <OrbitControls
      ref={controlsRef as React.RefObject<OrbitControlsType>}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      minDistance={0.5}
      maxDistance={20}
      autoRotate={autoRotate}
      autoRotateSpeed={1.2}
    />
  );
}

// ---------------------------------------------------------------------------
// Zoom helper — must execute inside Canvas via useThree
// ---------------------------------------------------------------------------

function ZoomController({
  zoomDelta,
  onZoomConsumed,
}: {
  zoomDelta: number;
  onZoomConsumed: () => void;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (zoomDelta === 0) return;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    camera.position.addScaledVector(dir, zoomDelta * 0.3);
    onZoomConsumed();
  });

  return null;
}

// ---------------------------------------------------------------------------
// Scene content
// ---------------------------------------------------------------------------

interface SceneContentProps {
  params: CADParameters;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  autoRotate: boolean;
  zoomDelta: number;
  onZoomConsumed: () => void;
  /** When true, renders StressOverlayMesh alongside IndustrialPart. */
  stressMode: boolean;
  stressState: import("@/utils/stressSimulator").StressState;
}

function SceneContent({
  params,
  controlsRef,
  autoRotate,
  zoomDelta,
  onZoomConsumed,
  stressMode,
  stressState,
}: SceneContentProps) {
  return (
    <>
      {/* ── Lighting ────────────────────────────────────────────────────── */}
      {/* Rupture mode: tint ambient to red to underscore failure state */}
      <ambientLight
        intensity={0.35}
        color={stressState.status === "rupture" ? "#ff3333" : "#ffffff"}
      />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-4, 6, -4]} intensity={0.5} color="#cce8ff" />
      <pointLight position={[0, 4, 6]} intensity={0.4} color="#ffffff" />

      {/* ── HDR environment for PBR reflections ─────────────────────────── */}
      <Environment preset="studio" />

      {/* ── Part: geometry-only mode ─────────────────────────────────────── */}
      {!stressMode && (
        <Suspense fallback={null}>
          <IndustrialPart params={params} />
        </Suspense>
      )}

      {/* ── Part: stress simulation mode — overlay replaces body colour ─── */}
      {stressMode && (
        <Suspense fallback={null}>
          {/* Flanges + port rendered normally; body replaced by stress mesh */}
          <IndustrialPart params={params} stressMode />
          <StressOverlayMesh params={params} stressState={stressState} />
        </Suspense>
      )}

      {/* ── Contact shadows ─────────────────────────────────────────────── */}
      <ContactShadows
        position={[0, -s(params.length / 2) - 0.05, 0]}
        opacity={0.45}
        scale={6}
        blur={1.8}
        far={3}
        color="#000000"
      />

      {/* ── Infinite grid ───────────────────────────────────────────────── */}
      <Grid
        position={[0, -s(params.length / 2) - 0.08, 0]}
        args={[20, 20]}
        cellSize={0.4}
        cellThickness={0.5}
        cellColor="#27272a"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#3f3f46"
        fadeDistance={18}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* ── Orbit + zoom controllers ─────────────────────────────────────── */}
      <CameraController controlsRef={controlsRef} autoRotate={autoRotate} />
      <ZoomController zoomDelta={zoomDelta} onZoomConsumed={onZoomConsumed} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Dimensional legend item
// ---------------------------------------------------------------------------

function LegendRow({
  label,
  value,
  unit,
  resolved,
}: {
  label: string;
  value: number;
  unit: string;
  resolved: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            resolved ? "bg-emerald-400" : "bg-zinc-500"
          }`}
        />
        <span className="text-zinc-400 text-xs truncate">{label}</span>
      </div>
      <span
        className={`text-xs font-mono tabular-nums flex-shrink-0 ${
          resolved ? "text-zinc-100" : "text-zinc-500"
        }`}
      >
        {value.toFixed(1)}
        <span className="text-zinc-500 ml-0.5">{unit}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Material badge
// ---------------------------------------------------------------------------

const MATERIAL_LABELS: Record<MaterialType, string> = {
  stainless_steel: "Stainless Steel",
  brass: "Brass",
  cast_iron: "Cast Iron",
  pvc: "PVC",
};

const MATERIAL_BADGE_CLASS: Record<MaterialType, string> = {
  stainless_steel: "bg-sky-900/60 text-sky-300 border-sky-700/50",
  brass: "bg-yellow-900/60 text-yellow-300 border-yellow-700/50",
  cast_iron: "bg-zinc-800/60 text-zinc-300 border-zinc-600/50",
  pvc: "bg-stone-800/60 text-stone-300 border-stone-600/50",
};

// ---------------------------------------------------------------------------
// Overlay controls
// ---------------------------------------------------------------------------

interface OverlayControlsProps {
  params: CADParameters;
  resolvedFields: CADMapperResult["resolvedFields"];
  confidence: number;
  autoRotate: boolean;
  onAutoRotateToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

import type { CADMapperResult } from "@/types/cad";

function OverlayControls({
  params,
  resolvedFields,
  confidence,
  autoRotate,
  onAutoRotateToggle,
  onZoomIn,
  onZoomOut,
  onResetView,
}: OverlayControlsProps) {
  const [legendOpen, setLegendOpen] = useState(true);

  const confidencePct = Math.round(confidence * 100);
  const confidenceColour =
    confidence >= 0.8
      ? "text-emerald-400"
      : confidence >= 0.4
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <>
      {/* ── Top-left: material badge + confidence ─────────────────────── */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${
            MATERIAL_BADGE_CLASS[params.materialType]
          }`}
        >
          <Cpu size={11} />
          {MATERIAL_LABELS[params.materialType]}
        </span>
        <span className="text-xs text-zinc-500">
          Confidence:{" "}
          <span className={`font-semibold ${confidenceColour}`}>
            {confidencePct}%
          </span>
        </span>
      </div>

      {/* ── Top-right: action controls ───────────────────────────────── */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={onZoomIn}
          title="Zoom in"
          className="w-8 h-8 rounded-md bg-zinc-800/80 border border-zinc-700/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition-colors"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={onZoomOut}
          title="Zoom out"
          className="w-8 h-8 rounded-md bg-zinc-800/80 border border-zinc-700/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition-colors"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={onAutoRotateToggle}
          title={autoRotate ? "Stop rotation" : "Auto-rotate"}
          className={`w-8 h-8 rounded-md border flex items-center justify-center transition-colors ${
            autoRotate
              ? "bg-emerald-800/70 border-emerald-600/60 text-emerald-300"
              : "bg-zinc-800/80 border-zinc-700/60 text-zinc-300 hover:bg-zinc-700/80 hover:text-zinc-100"
          }`}
        >
          <RefreshCw size={15} className={autoRotate ? "animate-spin" : ""} />
        </button>
        <button
          onClick={onResetView}
          title="Reset camera"
          className="w-8 h-8 rounded-md bg-zinc-800/80 border border-zinc-700/60 hover:bg-zinc-700/80 text-zinc-300 hover:text-zinc-100 flex items-center justify-center transition-colors"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* ── Bottom-right: dimensional legend ─────────────────────────── */}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="bg-zinc-900/90 border border-zinc-700/60 rounded-lg backdrop-blur-sm overflow-hidden w-52">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800/60 transition-colors"
            onClick={() => setLegendOpen((o) => !o)}
          >
            <span className="flex items-center gap-1.5">
              <Info size={11} className="text-sky-400" />
              Dimensions
            </span>
            <span className="text-zinc-600">{legendOpen ? "▲" : "▼"}</span>
          </button>

          {legendOpen && (
            <div className="px-3 pb-2.5 pt-0.5 border-t border-zinc-800/60 space-y-0">
              <LegendRow
                label="Outer Ø"
                value={params.outerDiameter}
                unit="mm"
                resolved={!!resolvedFields.outerDiameter}
              />
              <LegendRow
                label="Inner Ø"
                value={params.innerDiameter}
                unit="mm"
                resolved={!!resolvedFields.innerDiameter}
              />
              <LegendRow
                label="Length"
                value={params.length}
                unit="mm"
                resolved={!!resolvedFields.length}
              />
              <LegendRow
                label="Flange Ø"
                value={params.flangeDiameter}
                unit="mm"
                resolved={!!resolvedFields.flangeDiameter}
              />
              <LegendRow
                label="Port Ø"
                value={params.portSize}
                unit="mm"
                resolved={!!resolvedFields.portSize}
              />
              <div className="mt-2 pt-1.5 border-t border-zinc-800/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-zinc-600 text-[10px]">parsed from spec</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 ml-1" />
                <span className="text-zinc-600 text-[10px]">default</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom-left: interaction hint ────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-10">
        <p className="text-[10px] text-zinc-600 select-none">
          Drag to orbit · Scroll to zoom · Right-drag to pan
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

// Default camera position — pulled back enough for typical industrial parts
const DEFAULT_CAMERA_POSITION: [number, number, number] = [2.2, 1.6, 3.5];

export function Parametric3DViewer({
  extractedSpecs,
  className = "",
  externalStressMode,
  externalPSI,
  externalTempF,
  onStressModeChange,
  onPSIChange,
  onTempChange,
}: Parametric3DViewerProps) {
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [zoomDelta, setZoomDelta] = useState(0);

  const specsKey = JSON.stringify(extractedSpecs);

  // Derive CAD parameters — memoised on specs object identity
  const { parameters, confidence, resolvedFields } = useMemo(
    () => extractCADParameters(extractedSpecs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [specsKey]
  );

  // Stress panel state — owned here so sliders drive SceneContent in real-time
  const {
    stressMode,
    sliderPSI,
    sliderTempF,
    toggleMode,
    setStressMode,
    setPSI,
    setTempF,
  } = useStressPanel(parameters.materialType);

  // Synchronize with external controlled props
  useEffect(() => {
    if (externalStressMode !== undefined) {
      setStressMode(externalStressMode);
    }
  }, [externalStressMode, setStressMode]);

  useEffect(() => {
    if (externalPSI !== undefined) {
      setPSI(externalPSI);
    }
  }, [externalPSI, setPSI]);

  useEffect(() => {
    if (externalTempF !== undefined) {
      setTempF(externalTempF);
    }
  }, [externalTempF, setTempF]);

  const handleToggleMode = useCallback(() => {
    toggleMode();
    onStressModeChange?.(!stressMode);
  }, [toggleMode, onStressModeChange, stressMode]);

  const handlePSIChange = useCallback(
    (psi: number) => {
      setPSI(psi);
      onPSIChange?.(psi);
    },
    [setPSI, onPSIChange]
  );

  const handleTempChange = useCallback(
    (tempF: number) => {
      setTempF(tempF);
      onTempChange?.(tempF);
    },
    [setTempF, onTempChange]
  );

  // Recalculate stress state on every slider change (synchronous, cheap)
  const stressState = useMemo(
    () =>
      calculateStressState(
        extractedSpecs,
        parameters.materialType,
        stressMode ? sliderPSI : undefined,
        stressMode ? sliderTempF : undefined
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parameters.materialType, stressMode, sliderPSI, sliderTempF, specsKey]
  );

  const handleZoomIn = useCallback(() => setZoomDelta(1), []);
  const handleZoomOut = useCallback(() => setZoomDelta(-1), []);
  const handleZoomConsumed = useCallback(() => setZoomDelta(0), []);
  const handleAutoRotateToggle = useCallback(
    () => setAutoRotate((r) => !r),
    []
  );

  const handleResetView = useCallback(() => {
    if (!controlsRef.current) return;
    const ctrl = controlsRef.current;
    ctrl.reset();
    // Restore default camera position after reset
    ctrl.object.position.set(...DEFAULT_CAMERA_POSITION);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
  }, []);

  return (
    <div
      className={`relative w-full h-full bg-zinc-900 rounded-lg overflow-hidden ${className}`}
      style={{ minHeight: 360 }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: DEFAULT_CAMERA_POSITION, fov: 42, near: 0.05, far: 100 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        style={{ background: "#18181b" }} // zinc-900
      >
        <SceneContent
          params={parameters}
          controlsRef={controlsRef}
          autoRotate={autoRotate}
          zoomDelta={zoomDelta}
          onZoomConsumed={handleZoomConsumed}
          stressMode={stressMode}
          stressState={stressState}
        />
      </Canvas>

      <OverlayControls
        params={parameters}
        resolvedFields={resolvedFields}
        confidence={confidence}
        autoRotate={autoRotate}
        onAutoRotateToggle={handleAutoRotateToggle}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
      />

      {/* ── Stress analysis panel — bottom-left floating overlay ─────────── */}
      <div className="absolute bottom-10 left-3 z-20">
        <StressAnalysisPanel
          materialType={parameters.materialType}
          stressState={stressState}
          stressMode={stressMode}
          sliderPSI={sliderPSI}
          sliderTempF={sliderTempF}
          onToggleMode={handleToggleMode}
          onPSIChange={handlePSIChange}
          onTempChange={handleTempChange}
        />
      </div>
    </div>
  );
}
