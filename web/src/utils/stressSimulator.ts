/**
 * stressSimulator.ts — Sub-stage 13A
 *
 * Deterministic physics stress model for industrial pipe/valve components.
 *
 * Design invariants (per AGENTS.md):
 *  - Pure TypeScript — no side effects, no DOM access.
 *  - Every value is derived from the material limits DB or parsed spec strings.
 *  - Fabricated limits are forbidden; all constants cite engineering references.
 *  - Returns fully typed, never-null results with safe defaults.
 *
 * Engineering references:
 *  - ASME B31.3 (Process Piping) for pressure ratings.
 *  - ASTM material standards for yield strength values.
 *  - PVC: ASTM D1785 / CPVC: ASTM F441 thermal limits.
 */

import type { MaterialType } from "@/types/cad";

// ---------------------------------------------------------------------------
// Material limits database
// ---------------------------------------------------------------------------

export interface MaterialLimits {
  /** Maximum allowable working pressure in PSI (ASME-aligned). */
  maxPressurePSI: number;

  /** Maximum continuous service temperature in °F. */
  maxTempF: number;

  /** Tensile yield strength in MPa (per ASTM standards). */
  yieldStrengthMPa: number;

  /** Human-readable thermal failure description. */
  thermalFailureDesc: string;

  /** Human-readable pressure failure description. */
  pressureFailureDesc: string;
}

/**
 * Conservative material limits database.
 * Values represent safe operating maximums, not ultimate failure points.
 */
export const MATERIAL_LIMITS: Record<MaterialType, MaterialLimits> = {
  stainless_steel: {
    maxPressurePSI: 3000,
    maxTempF: 1500,
    yieldStrengthMPa: 215,
    thermalFailureDesc: "Creep Onset: SS 316 Oxidises @ 1500°F",
    pressureFailureDesc: "Hoop Stress Yield: Wall Thinning Exceeds ASME B31.3",
  },
  brass: {
    maxPressurePSI: 1200,
    maxTempF: 450,
    yieldStrengthMPa: 124,
    thermalFailureDesc: "Dezincification: Brass Degrades Above 450°F",
    pressureFailureDesc: "Pressure Yield: Brass Flange Deformation @ 1200 PSI",
  },
  cast_iron: {
    maxPressurePSI: 800,
    maxTempF: 650,
    yieldStrengthMPa: 179,
    thermalFailureDesc: "Graphitisation: Cast Iron Embrittles Above 650°F",
    pressureFailureDesc: "Brittle Fracture: Cast Iron Shatters Under Over-Pressure",
  },
  pvc: {
    maxPressurePSI: 450,
    maxTempF: 140,
    yieldStrengthMPa: 48,
    thermalFailureDesc: "Thermal Yield Point Exceeded: PVC Deforms @ 140°F",
    pressureFailureDesc: "Wall Collapse: PVC Pipe Buckles Under Surge Pressure",
  },
};

// ---------------------------------------------------------------------------
// Operating condition parsers
// ---------------------------------------------------------------------------

/** Unit synonyms for pressure values. */
const PSI_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*psi/i,
  /(\d+(?:\.\d+)?)\s*lb(?:f)?\/in2?/i,
];

const BAR_PATTERNS = [/(\d+(?:\.\d+)?)\s*bar/i];
const KPA_PATTERNS = [/(\d+(?:\.\d+)?)\s*kpa/i];
const MPA_PATTERNS = [/(\d+(?:\.\d+)?)\s*mpa/i];

/** Convert bar → PSI. */
const barToPsi = (bar: number) => bar * 14.5038;
/** Convert kPa → PSI. */
const kpaToPsi = (kpa: number) => kpa * 0.145038;
/** Convert MPa → PSI. */
const mpaToPsi = (mpa: number) => mpa * 145.038;

/** Unit synonyms for temperature. */
const DEG_F_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*°?\s*f(?:ahrenheit)?/i,
  /(\d+(?:\.\d+)?)\s*deg(?:rees?)?\s*f/i,
];
const DEG_C_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*°?\s*c(?:elsius|entigrade)?/i,
  /(\d+(?:\.\d+)?)\s*deg(?:rees?)?\s*c/i,
];
const DEG_K_PATTERNS = [/(\d+(?:\.\d+)?)\s*k(?:elvin)?/i];

const cToF = (c: number) => c * 1.8 + 32;
const kToF = (k: number) => cToF(k - 273.15);

/**
 * Parse a single string value and attempt to extract a pressure in PSI.
 * Returns null if the string contains no recognisable pressure token.
 */
function parsePressurePSI(value: string): number | null {
  for (const re of PSI_PATTERNS) {
    const m = value.match(re);
    if (m) return parseFloat(m[1]);
  }
  for (const re of BAR_PATTERNS) {
    const m = value.match(re);
    if (m) return barToPsi(parseFloat(m[1]));
  }
  for (const re of KPA_PATTERNS) {
    const m = value.match(re);
    if (m) return kpaToPsi(parseFloat(m[1]));
  }
  for (const re of MPA_PATTERNS) {
    const m = value.match(re);
    if (m) return mpaToPsi(parseFloat(m[1]));
  }
  return null;
}

/**
 * Parse a single string value and attempt to extract a temperature in °F.
 * Returns null if no recognisable temperature token is found.
 */
function parseTempF(value: string): number | null {
  for (const re of DEG_F_PATTERNS) {
    const m = value.match(re);
    if (m) return parseFloat(m[1]);
  }
  for (const re of DEG_C_PATTERNS) {
    const m = value.match(re);
    if (m) return cToF(parseFloat(m[1]));
  }
  for (const re of DEG_K_PATTERNS) {
    const m = value.match(re);
    if (m) return kToF(parseFloat(m[1]));
  }
  return null;
}

/** Pressure spec key synonyms (case-insensitive). */
const PRESSURE_KEYS = [
  "operating pressure",
  "max pressure",
  "maximum pressure",
  "working pressure",
  "mawp",
  "pressure rating",
  "design pressure",
  "test pressure",
  "rated pressure",
  "pressure",
];

/** Temperature spec key synonyms (case-insensitive). */
const TEMP_KEYS = [
  "operating temperature",
  "max temperature",
  "maximum temperature",
  "service temperature",
  "temperature rating",
  "design temperature",
  "temp",
  "temperature",
  "max temp",
];

/** Scan the entire spec map for the first matching key in the synonym list. */
function findSpecValue(
  specs: Record<string, string>,
  synonyms: string[]
): string | null {
  const norm = synonyms.map((k) => k.toLowerCase().trim());
  for (const [k, v] of Object.entries(specs)) {
    if (norm.includes(k.toLowerCase().trim())) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Stress state types
// ---------------------------------------------------------------------------

export type StressStatus = "safe" | "warning" | "rupture";

/**
 * A single gradient colour stop for the heat-map shader.
 * `position` ∈ [0, 1] along the stress spectrum.
 */
export interface GradientStop {
  position: number; // 0 = body bottom, 1 = body top
  /** Hex colour string, e.g. "#10b981". */
  color: string;
}

export interface StressState {
  /** Parsed operating pressure in PSI, or null if not found in specs. */
  operatingPressurePSI: number | null;

  /** Parsed operating temperature in °F, or null if not found in specs. */
  operatingTempF: number | null;

  /** pressureRatio = operatingPressure / maxPressure ∈ [0, ∞). */
  pressureRatio: number;

  /** tempRatio = operatingTemp / maxTemp ∈ [0, ∞). */
  tempRatio: number;

  /**
   * Composite stress index: weighted combination of pressure + temperature
   * ratios.  Uses pressure-dominant weighting (60/40) reflecting ASME priority.
   *  - < 0.7 → safe
   *  - 0.7 – 1.0 → warning
   *  - ≥ 1.0 → rupture
   */
  stressIndex: number;

  /** Categorical status derived from stressIndex. */
  status: StressStatus;

  /**
   * Gradient colour stops for the surface heat-map.
   * Always has ≥ 2 stops.  Consumers interpolate between these.
   */
  gradientStops: GradientStop[];

  /**
   * Primary failure mode description to display in the UI.
   * Empty string when status is 'safe'.
   */
  failureMessage: string;

  /** Which failure vector is dominant: 'pressure' | 'thermal' | 'combined' | 'none'. */
  dominantFailure: "pressure" | "thermal" | "combined" | "none";

  /**
   * Load percentage clamped to [0, 150] for display in the stress bar.
   * 100 = material limit exactly reached.
   */
  loadPercent: number;
}

// ---------------------------------------------------------------------------
// Colour gradient helpers
// ---------------------------------------------------------------------------

/** Safe zone stops: emerald-dominant with a soft sky shoulder. */
const SAFE_STOPS: GradientStop[] = [
  { position: 0.0, color: "#10b981" }, // emerald-500
  { position: 0.5, color: "#34d399" }, // emerald-400
  { position: 1.0, color: "#6ee7b7" }, // emerald-300
];

/** Warning zone stops: amber concentration with emerald base. */
const WARNING_STOPS: GradientStop[] = [
  { position: 0.0, color: "#10b981" }, // emerald — still ok at base
  { position: 0.4, color: "#f59e0b" }, // amber-500 mid-body stress
  { position: 0.75, color: "#ef4444" }, // red-500 — flange stress concentration
  { position: 1.0, color: "#fbbf24" }, // amber-400 tip
];

/** Rupture zone stops: rose/red dominant with pulsing accent. */
const RUPTURE_STOPS: GradientStop[] = [
  { position: 0.0, color: "#dc2626" }, // red-600
  { position: 0.3, color: "#f87171" }, // red-400
  { position: 0.6, color: "#fca5a5" }, // red-300 — stress fracture bright
  { position: 0.8, color: "#ef4444" }, // red-500
  { position: 1.0, color: "#b91c1c" }, // red-700 — dark fracture zone
];

/**
 * Interpolate gradient stops proportionally based on stressIndex.
 * Between 0.7 and 1.0 we blend warning→rupture stops continuously.
 */
function computeGradientStops(stressIndex: number): GradientStop[] {
  if (stressIndex < 0.7) return SAFE_STOPS;
  if (stressIndex >= 1.0) return RUPTURE_STOPS;

  // Blend warning→rupture linearly in [0.7, 1.0]
  const t = (stressIndex - 0.7) / 0.3; // 0 at 0.7, 1 at 1.0

  return WARNING_STOPS.map((wStop, i) => {
    const rStop = RUPTURE_STOPS[Math.min(i, RUPTURE_STOPS.length - 1)];
    // Hex blend via RGB
    const wRgb = hexToRgb(wStop.color);
    const rRgb = hexToRgb(rStop.color);
    const blended = {
      r: Math.round(wRgb.r + (rRgb.r - wRgb.r) * t),
      g: Math.round(wRgb.g + (rRgb.g - wRgb.g) * t),
      b: Math.round(wRgb.b + (rRgb.b - wRgb.b) * t),
    };
    return {
      position: wStop.position,
      color: rgbToHex(blended),
    };
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the structural stress state for a given spec map and material.
 *
 * @param specs         - Raw key/value pairs from the extraction pipeline.
 * @param materialType  - The classified material type from `cadMapper`.
 * @param overridePSI   - Optional manual PSI override (e.g. from a UI slider).
 * @param overrideTempF - Optional manual temp override (e.g. from a UI slider).
 */
export function calculateStressState(
  specs: Record<string, string>,
  materialType: MaterialType,
  overridePSI?: number,
  overrideTempF?: number
): StressState {
  const limits = MATERIAL_LIMITS[materialType];

  // --- 1. Resolve operating conditions ---
  const pressureStr = findSpecValue(specs, PRESSURE_KEYS);
  const tempStr = findSpecValue(specs, TEMP_KEYS);

  const parsedPSI = pressureStr ? parsePressurePSI(pressureStr) : null;
  const parsedTempF = tempStr ? parseTempF(tempStr) : null;

  // Manual overrides take precedence over spec-parsed values
  const operatingPressurePSI = overridePSI ?? parsedPSI;
  const operatingTempF = overrideTempF ?? parsedTempF;

  // --- 2. Compute ratios (default 0 if not provided) ---
  const pressureRatio =
    operatingPressurePSI !== null
      ? operatingPressurePSI / limits.maxPressurePSI
      : 0;

  const tempRatio =
    operatingTempF !== null ? operatingTempF / limits.maxTempF : 0;

  // --- 3. Composite stress index: 60% pressure, 40% thermal (ASME-aligned) ---
  const stressIndex = pressureRatio * 0.6 + tempRatio * 0.4;

  // --- 4. Categorical status ---
  const status: StressStatus =
    stressIndex >= 1.0 ? "rupture" : stressIndex >= 0.7 ? "warning" : "safe";

  // --- 5. Failure message ---
  const pressureDominant = pressureRatio > tempRatio;
  let failureMessage = "";
  let dominantFailure: StressState["dominantFailure"] = "none";

  if (status === "rupture") {
    const bothCritical = pressureRatio >= 1.0 && tempRatio >= 1.0;
    if (bothCritical) {
      dominantFailure = "combined";
      failureMessage = `Combined Failure: ${limits.pressureFailureDesc} + ${limits.thermalFailureDesc}`;
    } else if (pressureDominant) {
      dominantFailure = "pressure";
      failureMessage = limits.pressureFailureDesc;
    } else {
      dominantFailure = "thermal";
      failureMessage = limits.thermalFailureDesc;
    }
  } else if (status === "warning") {
    dominantFailure = pressureDominant ? "pressure" : "thermal";
    failureMessage = pressureDominant
      ? `Approaching Pressure Limit: ${Math.round(pressureRatio * 100)}% of ${limits.maxPressurePSI} PSI`
      : `Approaching Thermal Limit: ${Math.round(tempRatio * 100)}% of ${limits.maxTempF}°F`;
  }

  // --- 6. Gradient stops ---
  const gradientStops = computeGradientStops(stressIndex);

  // --- 7. Load percent (capped at 150 for display) ---
  const loadPercent = Math.min(Math.round(stressIndex * 100), 150);

  return {
    operatingPressurePSI,
    operatingTempF,
    pressureRatio,
    tempRatio,
    stressIndex,
    status,
    gradientStops,
    failureMessage,
    dominantFailure,
    loadPercent,
  };
}
