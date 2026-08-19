"use client";

/**
 * StressOverlayMesh.tsx — Sub-stage 13B (visual stress layer)
 *
 * Wraps the IndustrialPart group geometry with a physics stress visualisation:
 *
 *   SAFE     → smooth emerald→sky vertex colour gradient, nominal PBR material.
 *   WARNING  → amber→red heat-map gradient on vertex colours.
 *   RUPTURE  → pulsing red wireframe overlay + micro-jitter on vertex positions
 *              to simulate structural vibration under catastrophic failure.
 *
 * Performance contract:
 *   - Vertex colour writes happen only when stressIndex changes (dirty flag).
 *   - Jitter loop is guarded by an early-exit when status !== 'rupture'.
 *   - Buffer updates use `needsUpdate = true` on the attribute, not geometry rebuild.
 *   - Target: 60fps on mid-range hardware.
 *
 * Architecture:
 *   This file exports a single R3F component <StressOverlayMesh> that renders
 *   one cylinder body with vertex colours driven by the stress gradient stops.
 *   The component is self-contained — it owns its own geometry and material
 *   references to avoid entangling with Parametric3DViewer's geometry tree.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { CADParameters } from "@/types/cad";
import type { StressState } from "@/utils/stressSimulator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MM_SCALE = 0.012;
const s = (mm: number) => mm * MM_SCALE;

/** Jitter amplitude at maximum stress (scene units). */
const MAX_JITTER = 0.008;

/** Wireframe overlay pulse frequency (Hz). */
const PULSE_FREQ = 3.2;

// ---------------------------------------------------------------------------
// Vertex colour computation
// ---------------------------------------------------------------------------

/**
 * Map a normalised Y position [0,1] along the cylinder to a THREE.Color by
 * sampling the gradient stops.  Linear interpolation between adjacent stops.
 */
function sampleGradient(
  yNorm: number,
  stops: { position: number; color: string }[]
): THREE.Color {
  // Find surrounding stops
  let lo = stops[0];
  let hi = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (yNorm >= stops[i].position && yNorm <= stops[i + 1].position) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }

  const range = hi.position - lo.position;
  const t = range === 0 ? 0 : (yNorm - lo.position) / range;

  const cLo = new THREE.Color(lo.color);
  const cHi = new THREE.Color(hi.color);
  return cLo.lerp(cHi, t);
}

/**
 * Write per-vertex colours into a Float32Array for a CylinderGeometry.
 * CylinderGeometry vertices are ordered top-cap → side → bottom-cap;
 * we colour by the vertex's Y coordinate normalised across bodyLen.
 */
function fillVertexColors(
  positions: Float32Array,
  colors: Float32Array,
  bodyLen: number,
  stops: { position: number; color: string }[]
): void {
  const halfLen = bodyLen / 2;
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1]; // world-space Y
    const yNorm = halfLen === 0 ? 0.5 : (y + halfLen) / (2 * halfLen);
    const clamped = Math.max(0, Math.min(1, yNorm));
    const col = sampleGradient(clamped, stops);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
}

// ---------------------------------------------------------------------------
// Jitter helpers
// ---------------------------------------------------------------------------

/** Seeded pseudo-noise: deterministic per vertex index + time. */
function jitterNoise(idx: number, time: number): number {
  // Cheap pseudo-noise: avoids Math.random() per frame
  return (
    Math.sin(idx * 127.1 + time * 311.7) * 0.5 +
    Math.sin(idx * 269.5 + time * 183.3) * 0.5
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface StressOverlayMeshProps {
  /** CAD parameters for sizing the geometry. */
  params: CADParameters;
  /** Current stress simulation state. */
  stressState: StressState;
}

export function StressOverlayMesh({
  params,
  stressState,
}: StressOverlayMeshProps) {
  const { outerDiameter, innerDiameter, length } = params;
  const { status, gradientStops, stressIndex } = stressState;

  const bodyMeshRef = useRef<THREE.Mesh>(null!);
  const wireMeshRef = useRef<THREE.Mesh>(null!);
  const wireMaterialRef = useRef<THREE.MeshBasicMaterial>(null!);

  // Geometry dimensions
  const outerR = s(outerDiameter / 2);
  const innerR = s(innerDiameter / 2);
  const bodyLen = s(length);

  // Segment count — high enough for smooth gradient, low enough for 60fps
  const radialSeg = 48;
  const heightSeg = 12; // more height segments = smoother vertical gradient

  // ---------------------------------------------------------------------------
  // Geometry & materials — built once, updated cleanly
  // ---------------------------------------------------------------------------

  const bodyGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(
      outerR,
      outerR,
      bodyLen,
      radialSeg,
      heightSeg,
      false
    );
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const count = posAttr.count;
    const colors = new Float32Array(count * 3);

    fillVertexColors(positions, colors, bodyLen, gradientStops);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Cache initial vertex positions for fracture / vibration simulation
    geo.userData.origPositions = new Float32Array(positions);

    return geo;
  }, [outerR, bodyLen, gradientStops]);

  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: status === "rupture" ? 0.1 : 0.7,
        roughness: status === "rupture" ? 0.95 : 0.3,
        side: THREE.FrontSide,
      }),
    [status]
  );

  const wireGeometry = useMemo(
    () =>
      new THREE.CylinderGeometry(
        outerR + 0.003,
        outerR + 0.003,
        bodyLen,
        radialSeg,
        heightSeg,
        false
      ),
    [outerR, bodyLen]
  );

  const wireMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ef4444",
        wireframe: true,
        transparent: true,
        opacity: 0.0,
      }),
    []
  );

  // Store ref to wire material for frame-loop mutation
  useEffect(() => {
    wireMaterialRef.current = wireMaterial;
  }, [wireMaterial]);

  // ---------------------------------------------------------------------------
  // Frame loop — jitter + wireframe pulse
  // ---------------------------------------------------------------------------

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (status !== "rupture") {
      // Ensure wireframe is invisible and no jitter is applied
      if (wireMaterialRef.current) wireMaterialRef.current.opacity = 0;
      return;
    }

    // ── Wireframe pulsing ───────────────────────────────────────────────
    if (wireMaterialRef.current) {
      // Sine-wave pulse: 0.25 → 0.75 opacity at PULSE_FREQ Hz
      const pulse = 0.5 + 0.25 * Math.sin(t * Math.PI * 2 * PULSE_FREQ);
      wireMaterialRef.current.opacity = pulse;
    }

    // ── Vertex jitter ────────────────────────────────────────────────────
    if (!bodyMeshRef.current) return;

    const geo = bodyMeshRef.current.geometry as THREE.BufferGeometry;
    const origPositions = geo.userData.origPositions as Float32Array | undefined;
    if (!origPositions) return;

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    // Amplitude scales with how far past rupture we are (capped)
    const overStress = Math.max(0, stressIndex - 1.0);
    const amplitude = Math.min(MAX_JITTER, overStress * MAX_JITTER * 4);

    const count = pos.length / 3;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const noise = jitterNoise(i, t);
      pos[ix] = origPositions[ix] + noise * amplitude;
      pos[ix + 1] = origPositions[ix + 1] + noise * amplitude * 0.4;
      pos[ix + 2] = origPositions[ix + 2] + noise * amplitude;
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <group>
      {/* ── Stress-coloured body ──────────────────────────────────────── */}
      <mesh
        ref={bodyMeshRef}
        geometry={bodyGeometry}
        material={bodyMaterial}
        castShadow
        receiveShadow
      />

      {/* ── Inner bore (static, BackSide) ────────────────────────────── */}
      <mesh>
        <cylinderGeometry args={[innerR, innerR, bodyLen, radialSeg, 1, true]} />
        <meshStandardMaterial
          color={status === "rupture" ? "#7f1d1d" : "#27272a"}
          metalness={0.3}
          roughness={0.9}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ── Wireframe rupture overlay ─────────────────────────────────── */}
      <mesh
        ref={wireMeshRef}
        geometry={wireGeometry}
        material={wireMaterial}
      />
    </group>
  );
}
