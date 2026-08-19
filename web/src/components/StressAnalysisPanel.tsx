"use client";

/**
 * StressAnalysisPanel.tsx — Sub-stage 13B (UI overlay)
 *
 * A glassmorphic floating side-panel overlaid on the 3D viewport.
 * Provides:
 *   - Mode toggle: "Geometry" vs "Physics Stress Simulator"
 *   - Manual PSI + Temperature sliders (override spec values in real-time)
 *   - Animated load bar (colour-transitions safe→warning→rupture)
 *   - Live failure mode readout with blinking indicator
 *   - Per-axis ratio breakdown (pressure vs thermal)
 *
 * This is a pure HTML overlay — no Three.js / R3F involved here.
 * It communicates upward via callbacks so Parametric3DViewer can pipe
 * the values into <StressOverlayMesh>.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Gauge,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Thermometer,
  Zap,
} from "lucide-react";

import { MATERIAL_LIMITS } from "@/utils/stressSimulator";
import type { StressState, StressStatus } from "@/utils/stressSimulator";
import type { MaterialType } from "@/types/cad";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StressAnalysisPanelProps {
  /** Current material type — determines slider upper bounds. */
  materialType: MaterialType;

  /** Current computed stress state (updated by parent on every slider move). */
  stressState: StressState;

  /** Whether stress simulation mode is active. */
  stressMode: boolean;

  /** Current slider PSI value (controlled by parent). */
  sliderPSI: number;

  /** Current slider temperature °F value (controlled by parent). */
  sliderTempF: number;

  /** Fired when the mode toggle is clicked. */
  onToggleMode: () => void;

  /** Fired when PSI slider moves. */
  onPSIChange: (psi: number) => void;

  /** Fired when temperature slider moves. */
  onTempChange: (tempF: number) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Horizontal progress bar with colour transitions. */
function StressBar({
  percent,
  status,
}: {
  percent: number;
  status: StressStatus;
}) {
  const barColor =
    status === "rupture"
      ? "bg-red-500"
      : status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const trackColor =
    status === "rupture"
      ? "bg-red-950/60"
      : status === "warning"
        ? "bg-amber-950/50"
        : "bg-emerald-950/50";

  const displayPct = Math.min(percent, 100);
  const overload = percent > 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
          Structural Load
        </span>
        <span
          className={`text-xs font-mono font-bold tabular-nums ${
            status === "rupture"
              ? "text-red-400"
              : status === "warning"
                ? "text-amber-400"
                : "text-emerald-400"
          }`}
        >
          {percent}%{overload && <span className="text-red-300 ml-0.5">▲</span>}
        </span>
      </div>

      {/* Track */}
      <div className={`h-3 rounded-full overflow-hidden ${trackColor} relative`}>
        {/* Limit marker at 100% */}
        <div className="absolute top-0 bottom-0 w-px bg-zinc-500/60 z-10" style={{ left: "100%" }} />

        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all duration-200 ease-out ${barColor} ${
            status === "rupture" ? "animate-pulse" : ""
          }`}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      {/* Zone labels */}
      <div className="flex text-[9px] text-zinc-600 justify-between px-0.5">
        <span>SAFE</span>
        <span>WARN</span>
        <span>CRITICAL</span>
      </div>
    </div>
  );
}

/** Blinking failure badge. */
function FailureBadge({ message, status }: { message: string; status: StressStatus }) {
  if (status === "safe" || !message) return null;

  const isRupture = status === "rupture";
  const Icon = isRupture ? ShieldAlert : AlertTriangle;

  return (
    <div
      className={`rounded-md border px-2.5 py-2 text-[11px] leading-snug flex gap-2 items-start ${
        isRupture
          ? "bg-red-950/70 border-red-700/60 text-red-300"
          : "bg-amber-950/60 border-amber-700/50 text-amber-300"
      }`}
    >
      <Icon
        size={13}
        className={`mt-0.5 flex-shrink-0 ${
          isRupture ? "text-red-400 animate-pulse" : "text-amber-400"
        }`}
      />
      <span>{message}</span>
    </div>
  );
}

/** Ratio gauge row: label, fill-bar, ratio value. */
function RatioRow({
  label,
  ratio,
  icon,
  color,
}: {
  label: string;
  ratio: number;
  icon: React.ReactNode;
  color: "blue" | "orange";
}) {
  const pct = Math.min(Math.round(ratio * 100), 150);
  const barClass =
    ratio >= 1.0
      ? "bg-red-500"
      : ratio >= 0.7
        ? color === "orange"
          ? "bg-amber-500"
          : "bg-sky-500"
        : color === "orange"
          ? "bg-orange-400"
          : "bg-blue-400";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          {icon}
          {label}
        </div>
        <span className="text-[11px] font-mono text-zinc-300 tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-150 ${barClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider with custom dark styling
// ---------------------------------------------------------------------------

function StressSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  dangerThreshold,
  icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  dangerThreshold: number;
  icon: React.ReactNode;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const isDanger = value >= dangerThreshold;
  const isWarn = value >= dangerThreshold * 0.7;

  const thumbColor = isDanger
    ? "#ef4444"
    : isWarn
      ? "#f59e0b"
      : "#10b981";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          {icon}
          {label}
        </div>
        <span
          className={`text-[11px] font-mono font-semibold tabular-nums ${
            isDanger
              ? "text-red-400"
              : isWarn
                ? "text-amber-400"
                : "text-zinc-200"
          }`}
        >
          {value.toLocaleString()}
          <span className="text-zinc-500 ml-0.5 font-normal">{unit}</span>
        </span>
      </div>

      <div className="relative h-5 flex items-center">
        {/* Track fill gradient */}
        <div className="absolute left-0 right-0 h-1.5 rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-colors duration-200 ${
              isDanger ? "bg-red-500" : isWarn ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Danger threshold marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-red-700/70 rounded-full z-10"
          style={{ left: `${((dangerThreshold - min) / (max - min)) * 100}%` }}
          title={`Material limit: ${dangerThreshold}${unit}`}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative z-20 w-full h-5 appearance-none bg-transparent cursor-pointer"
          style={{
            // Custom thumb colour injected via CSS variable
            ["--thumb-color" as string]: thumbColor,
          }}
        />
      </div>

      {/* Min/Max labels */}
      <div className="flex justify-between text-[9px] text-zinc-600 px-0.5">
        <span>{min.toLocaleString()}{unit}</span>
        <span className="text-red-800">
          {dangerThreshold.toLocaleString()}{unit} limit
        </span>
        <span>{max.toLocaleString()}{unit}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status header icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: StressStatus }) {
  if (status === "rupture") {
    return (
      <div className="flex items-center gap-1.5 text-red-400">
        <ShieldAlert size={14} className="animate-pulse" />
        <span className="text-xs font-bold tracking-wide uppercase">RUPTURE</span>
      </div>
    );
  }
  if (status === "warning") {
    return (
      <div className="flex items-center gap-1.5 text-amber-400">
        <AlertTriangle size={14} />
        <span className="text-xs font-bold tracking-wide uppercase">WARNING</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-emerald-400">
      <CheckCircle2 size={14} />
      <span className="text-xs font-bold tracking-wide uppercase">SAFE</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------

export function StressAnalysisPanel({
  materialType,
  stressState,
  stressMode,
  sliderPSI,
  sliderTempF,
  onToggleMode,
  onPSIChange,
  onTempChange,
}: StressAnalysisPanelProps) {
  const limits = MATERIAL_LIMITS[materialType];

  // Slider bounds: 0 → 120% of material max so operator can exceed limits
  const maxSliderPSI = Math.round(limits.maxPressurePSI * 1.2);
  const maxSliderTemp = Math.round(limits.maxTempF * 1.2);

  const { status, loadPercent, pressureRatio, tempRatio, failureMessage } = stressState;

  // Blinking rupture indicator
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (status !== "rupture") return;
    const id = setInterval(() => setBlink((b) => !b), 500);
    return () => clearInterval(id);
  }, [status]);

  const isBlinking = status === "rupture" && blink;

  return (
    <div className="w-64 bg-zinc-950/90 backdrop-blur-md border border-zinc-800/70 rounded-xl shadow-2xl overflow-hidden flex flex-col">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div
        className={`px-3 py-2.5 flex items-center justify-between border-b ${
          status === "rupture"
            ? `border-red-800/60 ${isBlinking ? "bg-red-950/50" : "bg-zinc-950/50"}`
            : status === "warning"
              ? "border-amber-800/50 bg-zinc-950/50"
              : "border-zinc-800/60 bg-zinc-950/50"
        } transition-colors duration-300`}
      >
        <div className="flex items-center gap-1.5">
          <Activity size={13} className="text-sky-400" />
          <span className="text-xs font-semibold text-zinc-200">
            Stress Analysis
          </span>
        </div>
        <StatusIcon status={status} />
      </div>

      {/* ── Mode toggle ─────────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-zinc-800/50">
        <button
          onClick={onToggleMode}
          className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg border transition-all duration-200 text-xs font-medium ${
            stressMode
              ? "bg-sky-900/40 border-sky-700/50 text-sky-300"
              : "bg-zinc-800/50 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Zap size={12} />
            {stressMode ? "Physics Stress Mode" : "Geometry Mode"}
          </span>
          {stressMode ? (
            <ToggleRight size={18} className="text-sky-400" />
          ) : (
            <ToggleLeft size={18} className="text-zinc-600" />
          )}
        </button>
      </div>

      {stressMode && (
        <>
          {/* ── Sliders ─────────────────────────────────────────────── */}
          <div className="px-3 py-3 space-y-4 border-b border-zinc-800/50">
            <StressSlider
              label="Operating Pressure"
              value={sliderPSI}
              min={0}
              max={maxSliderPSI}
              step={10}
              unit=" PSI"
              onChange={onPSIChange}
              dangerThreshold={limits.maxPressurePSI}
              icon={<Gauge size={11} />}
            />
            <StressSlider
              label="Operating Temp"
              value={sliderTempF}
              min={0}
              max={maxSliderTemp}
              step={5}
              unit="°F"
              onChange={onTempChange}
              dangerThreshold={limits.maxTempF}
              icon={<Thermometer size={11} />}
            />
          </div>

          {/* ── Load bar ─────────────────────────────────────────────── */}
          <div className="px-3 py-3 border-b border-zinc-800/50">
            <StressBar percent={loadPercent} status={status} />
          </div>

          {/* ── Ratio breakdown ──────────────────────────────────────── */}
          <div className="px-3 py-3 space-y-2.5 border-b border-zinc-800/50">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
              Failure Vectors
            </p>
            <RatioRow
              label="Pressure Load"
              ratio={pressureRatio}
              icon={<Gauge size={10} />}
              color="blue"
            />
            <RatioRow
              label="Thermal Load"
              ratio={tempRatio}
              icon={<Flame size={10} />}
              color="orange"
            />
          </div>

          {/* ── Failure readout ───────────────────────────────────────── */}
          <div className="px-3 py-3 space-y-2">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
              Failure Mode
            </p>
            {failureMessage ? (
              <FailureBadge message={failureMessage} status={status} />
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-600 text-[11px]">
                <CheckCircle2 size={11} />
                Within safe operating envelope
              </div>
            )}
          </div>

          {/* ── Material limits reference ─────────────────────────────── */}
          <div className="px-3 py-2.5 bg-zinc-900/60">
            <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold mb-1.5">
              Material Limits
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-600">Max PSI</span>
                <span className="text-zinc-400 font-mono">
                  {limits.maxPressurePSI.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-600">Max °F</span>
                <span className="text-zinc-400 font-mono">{limits.maxTempF}</span>
              </div>
              <div className="flex justify-between text-[10px] col-span-2">
                <span className="text-zinc-600">Yield Strength</span>
                <span className="text-zinc-400 font-mono">
                  {limits.yieldStrengthMPa} MPa
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: encapsulates all stress panel state for use in Parametric3DViewer
// ---------------------------------------------------------------------------

export interface UseStressPanelReturn {
  stressMode: boolean;
  sliderPSI: number;
  sliderTempF: number;
  toggleMode: () => void;
  setStressMode: (active: boolean) => void;
  setPSI: (v: number) => void;
  setTempF: (v: number) => void;
}

export function useStressPanel(materialType: MaterialType): UseStressPanelReturn {
  const limits = MATERIAL_LIMITS[materialType];

  const [stressMode, setStressMode] = useState(false);
  // Default sliders at 30% of material limits — visible but not alarming
  const [sliderPSI, setSliderPSI] = useState(
    Math.round(limits.maxPressurePSI * 0.3)
  );
  const [sliderTempF, setSliderTempF] = useState(
    Math.round(limits.maxTempF * 0.3)
  );

  const prevMaterialRef = useRef(materialType);

  // Reset sliders when material changes to stay within new limits
  useEffect(() => {
    if (prevMaterialRef.current !== materialType) {
      prevMaterialRef.current = materialType;
      const currentLimits = MATERIAL_LIMITS[materialType];
      setSliderPSI(Math.round(currentLimits.maxPressurePSI * 0.3));
      setSliderTempF(Math.round(currentLimits.maxTempF * 0.3));
    }
  }, [materialType]);

  const toggleMode = useCallback(() => setStressMode((m) => !m), []);
  const setPSI = useCallback((v: number) => setSliderPSI(v), []);
  const setTempF = useCallback((v: number) => setSliderTempF(v), []);

  return {
    stressMode,
    sliderPSI,
    sliderTempF,
    toggleMode,
    setStressMode,
    setPSI,
    setTempF,
  };
}
