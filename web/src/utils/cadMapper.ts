/**
 * cadMapper.ts — Sub-stage 12A
 *
 * Converts a raw `Record<string, string>` spec payload (as returned by the
 * extraction pipeline) into typed, unit-normalised `CADParameters` ready for
 * the Parametric3DViewer.
 *
 * Design invariants (per AGENTS.md):
 *  - Every extracted dimension carries a deterministic resolution path.
 *  - Safe fallback defaults ensure the 3D model always renders cleanly.
 *  - No LLM guesses; only regex / dictionary lookups + Pint-equivalent
 *    arithmetic performed in pure TypeScript.
 */

import type { CADMapperResult, CADParameters, MaterialType } from "@/types/cad";

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/** Convert inches to mm (1 in = 25.4 mm). */
const inToMm = (v: number): number => v * 25.4;

/** Convert centimetres to mm. */
const cmToMm = (v: number): number => v * 10;

/** Convert metres to mm. */
const mToMm = (v: number): number => v * 1000;

/**
 * Parse a dimension string such as "2.5 in", "63.5mm", '1"', "2½ inches"
 * and return a value in **millimetres** (scene units).
 *
 * Returns `null` if the string cannot be parsed.
 */
function parseDimension(raw: string): number | null {
  if (!raw) return null;

  const s = raw.trim().toLowerCase();

  // Normalise unicode fraction characters → decimal equivalents
  const unicodeFracs: [RegExp, string][] = [
    [/½/g, ".5"],
    [/¼/g, ".25"],
    [/¾/g, ".75"],
    [/⅓/g, ".333"],
    [/⅔/g, ".667"],
    [/⅛/g, ".125"],
    [/⅜/g, ".375"],
    [/⅝/g, ".625"],
    [/⅞/g, ".875"],
  ];
  let normalised = s;
  for (const [pattern, replacement] of unicodeFracs) {
    normalised = normalised.replace(pattern, replacement);
  }

  // Regex: optional integer part + optional fraction like "1 3/4"
  const numPat = /(\d+(?:\s+\d+\/\d+)?(?:\.\d+)?)/;

  // Inch patterns: 2.5", 2.5 in, 2.5 inch, 2.5 inches
  const inchMatch = normalised.match(
    new RegExp(`^${numPat.source}(?:\\s*\\/\\s*${numPat.source})?\\s*(?:"|in(?:ch(?:es)?)?|''|inches?)`)
  );
  if (inchMatch) {
    const val = evalFractionString(inchMatch[1]);
    if (val !== null) return inToMm(val);
  }

  // Millimetre patterns: 63.5mm, 63.5 mm
  const mmMatch = normalised.match(new RegExp(`^${numPat.source}\\s*mm`));
  if (mmMatch) {
    const val = evalFractionString(mmMatch[1]);
    if (val !== null) return val; // already mm
  }

  // Centimetre patterns
  const cmMatch = normalised.match(new RegExp(`^${numPat.source}\\s*cm`));
  if (cmMatch) {
    const val = evalFractionString(cmMatch[1]);
    if (val !== null) return cmToMm(val);
  }

  // Metre patterns
  const mMatch = normalised.match(new RegExp(`^${numPat.source}\\s*m(?:eter|etre|)?\\b`));
  if (mMatch) {
    const val = evalFractionString(mMatch[1]);
    if (val !== null) return mToMm(val);
  }

  // Bare number — assume mm (most common in engineering datasheets)
  const bareMatch = normalised.match(new RegExp(`^${numPat.source}\\s*$`));
  if (bareMatch) {
    const val = evalFractionString(bareMatch[1]);
    if (val !== null) return val;
  }

  return null;
}

/** Evaluate a string like "1 3/4" or "2.5" into a float. */
function evalFractionString(s: string): number | null {
  if (!s) return null;
  const parts = s.trim().split(/\s+/);
  if (parts.length === 1) {
    // May be "3/4" or "2.5"
    if (parts[0].includes("/")) {
      const [num, den] = parts[0].split("/").map(Number);
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
      return null;
    }
    const v = parseFloat(parts[0]);
    return isNaN(v) ? null : v;
  }
  if (parts.length === 2) {
    // "1 3/4"
    const whole = parseFloat(parts[0]);
    const fracParts = parts[1].split("/").map(Number);
    if (fracParts.length !== 2) return null;
    const [num, den] = fracParts;
    if (isNaN(whole) || isNaN(num) || isNaN(den) || den === 0) return null;
    return whole + num / den;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Key synonym dictionaries
// ---------------------------------------------------------------------------

/** Keys that map to outerDiameter. Checked case-insensitively. */
const OUTER_DIAMETER_KEYS = [
  "outer diameter",
  "outside diameter",
  "o.d.",
  "od",
  "outer dia",
  "outer dia.",
  "nominal od",
  "nominal diameter",
  "pipe od",
  "tube od",
  "body diameter",
  "diameter",
];

/** Keys that map to innerDiameter. */
const INNER_DIAMETER_KEYS = [
  "inner diameter",
  "inside diameter",
  "i.d.",
  "id",
  "bore diameter",
  "bore",
  "inner dia",
  "inner dia.",
  "pipe id",
  "tube id",
];

/** Keys that map to length. */
const LENGTH_KEYS = [
  "length",
  "l",
  "overall length",
  "face to face",
  "face-to-face",
  "f to f",
  "f-to-f",
  "end to end",
  "nominal length",
  "body length",
  "tube length",
];

/** Keys that map to flangeDiameter. */
const FLANGE_DIAMETER_KEYS = [
  "flange diameter",
  "flange dia",
  "flange dia.",
  "flange o.d.",
  "flange od",
  "bolt circle diameter",
  "bcd",
  "mounting diameter",
];

/** Keys that map to portSize. */
const PORT_SIZE_KEYS = [
  "port size",
  "port diameter",
  "port dia",
  "port dia.",
  "port o.d.",
  "nozzle size",
  "nozzle diameter",
  "orifice size",
  "valve port",
  "valve size",
  "nominal size",
  "connection size",
  "inlet size",
  "outlet size",
  "pipe size",
  "nominal pipe size",
  "nps",
  "dn",
];

/** Keywords that imply stainless steel. */
const SS_KEYWORDS = [
  "stainless",
  "stainless steel",
  "ss",
  "316",
  "304",
  "aisi",
  "astm a182",
];

/** Keywords that imply PVC. */
const PVC_KEYWORDS = ["pvc", "cpvc", "upvc", "pvcu", "polyvinyl"];

/** Keywords that imply brass. */
const BRASS_KEYWORDS = ["brass", "bronze", "gunmetal", "dezincification"];

/** Keywords that imply cast iron. */
const CI_KEYWORDS = [
  "cast iron",
  "grey iron",
  "gray iron",
  "ductile iron",
  "di",
  "gi",
  "galvanized iron",
  "cast",
];

// ---------------------------------------------------------------------------
// Fallback defaults (all values in mm)
// ---------------------------------------------------------------------------
const DEFAULTS: CADParameters = {
  outerDiameter: 60,
  innerDiameter: 40,
  length: 120,
  flangeDiameter: 90,
  portSize: 20,
  materialType: "stainless_steel",
};

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Find the first spec entry whose key matches one of the provided synonyms
 * (case-insensitive, leading/trailing whitespace ignored).
 */
function findByKeys(
  specs: Record<string, string>,
  synonyms: string[]
): string | null {
  const normSynonyms = synonyms.map((k) => k.toLowerCase().trim());
  for (const [key, value] of Object.entries(specs)) {
    if (normSynonyms.includes(key.toLowerCase().trim())) {
      return value;
    }
  }
  return null;
}

/** Resolve a dimension field from the spec map, returning null on failure. */
function resolveDimension(
  specs: Record<string, string>,
  synonyms: string[]
): number | null {
  const raw = findByKeys(specs, synonyms);
  if (!raw) return null;
  return parseDimension(raw);
}

/** Infer MaterialType from any spec value that contains material keywords. */
function resolveMaterial(specs: Record<string, string>): MaterialType {
  const allValues = Object.values(specs).join(" ").toLowerCase();
  const allKeys = Object.keys(specs).join(" ").toLowerCase();
  const combined = `${allKeys} ${allValues}`;

  if (SS_KEYWORDS.some((kw) => combined.includes(kw))) return "stainless_steel";
  if (BRASS_KEYWORDS.some((kw) => combined.includes(kw))) return "brass";
  if (PVC_KEYWORDS.some((kw) => combined.includes(kw))) return "pvc";
  if (CI_KEYWORDS.some((kw) => combined.includes(kw))) return "cast_iron";

  // Check explicit material keys
  const materialKeys = ["material", "body material", "material type", "construction"];
  const materialValue = findByKeys(specs, materialKeys)?.toLowerCase() ?? "";
  if (SS_KEYWORDS.some((kw) => materialValue.includes(kw))) return "stainless_steel";
  if (BRASS_KEYWORDS.some((kw) => materialValue.includes(kw))) return "brass";
  if (PVC_KEYWORDS.some((kw) => materialValue.includes(kw))) return "pvc";
  if (CI_KEYWORDS.some((kw) => materialValue.includes(kw))) return "cast_iron";

  return DEFAULTS.materialType;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract and normalise CAD parameters from a flat spec JSON object.
 *
 * @param extractedSpecs - Key/value pairs from the extraction pipeline, e.g.
 *   `{ "Outer Diameter": "2.5 in", "Length": "120mm", "Material": "SS316" }`.
 *
 * @returns A `CADMapperResult` with fully populated `parameters` (never null)
 *   and a `confidence` score reflecting parse success.
 */
export function extractCADParameters(
  extractedSpecs: Record<string, string>
): CADMapperResult {
  // --- 1. Resolve each dimension individually ---
  const rawOD = resolveDimension(extractedSpecs, OUTER_DIAMETER_KEYS);
  const rawID = resolveDimension(extractedSpecs, INNER_DIAMETER_KEYS);
  const rawLen = resolveDimension(extractedSpecs, LENGTH_KEYS);
  const rawFlange = resolveDimension(extractedSpecs, FLANGE_DIAMETER_KEYS);
  const rawPort = resolveDimension(extractedSpecs, PORT_SIZE_KEYS);

  // --- 2. Apply fallback defaults & enforce geometric constraints ---
  const outerDiameter = rawOD ?? DEFAULTS.outerDiameter;

  // Inner diameter must be strictly less than outer diameter
  let innerDiameter =
    rawID !== null
      ? Math.min(rawID, outerDiameter * 0.9) // cap at 90% of OD
      : DEFAULTS.innerDiameter < outerDiameter
        ? DEFAULTS.innerDiameter
        : outerDiameter * 0.65;

  // Guarantee ID < OD
  if (innerDiameter >= outerDiameter) {
    innerDiameter = outerDiameter * 0.65;
  }

  const length = rawLen ?? DEFAULTS.length;

  // Flange diameter must be >= outer diameter
  const flangeDiameter =
    rawFlange !== null
      ? Math.max(rawFlange, outerDiameter)
      : Math.max(DEFAULTS.flangeDiameter, outerDiameter * 1.35);

  // Port size must be < inner diameter
  const portSize =
    rawPort !== null
      ? Math.min(rawPort, innerDiameter * 0.8)
      : Math.min(DEFAULTS.portSize, innerDiameter * 0.55);

  const materialType = resolveMaterial(extractedSpecs);

  // --- 3. Compute confidence (5 parseable numeric dimensions) ---
  const parsedCount = [rawOD, rawID, rawLen, rawFlange, rawPort].filter(
    (v) => v !== null
  ).length;
  const confidence = parsedCount / 5;

  const resolvedFields: CADMapperResult["resolvedFields"] = {
    outerDiameter: rawOD !== null,
    innerDiameter: rawID !== null,
    length: rawLen !== null,
    flangeDiameter: rawFlange !== null,
    portSize: rawPort !== null,
  };

  return {
    parameters: {
      outerDiameter,
      innerDiameter,
      length,
      flangeDiameter,
      portSize,
      materialType,
    },
    confidence,
    resolvedFields,
  };
}
