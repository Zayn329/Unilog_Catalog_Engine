/**
 * CAD parameter types for the Parametric 3D Viewer (Sub-stage 12A/12B).
 *
 * All dimensional values are stored in Three.js scene units (1 unit ≈ 1 mm after
 * normalisation from the raw spec strings).  The mapper is responsible for the
 * conversion; the viewer components treat these values as opaque scene units.
 */

/** Supported material classes that drive PBR rendering properties. */
export type MaterialType =
  | "stainless_steel"
  | "pvc"
  | "brass"
  | "cast_iron";

/**
 * Normalised dimensional parameters extracted from a datasheet spec JSON.
 * Every field always has a valid numeric value — fallback defaults are applied
 * by `extractCADParameters` when a dimension cannot be parsed from the source.
 */
export interface CADParameters {
  /** Outer diameter of the main body cylinder, in scene units (mm). */
  outerDiameter: number;

  /** Inner bore diameter — must be strictly less than outerDiameter. */
  innerDiameter: number;

  /** Overall length of the part along its primary axis, in scene units (mm). */
  length: number;

  /** Diameter of the mounting flanges at each end of the part, in scene units. */
  flangeDiameter: number;

  /**
   * Nominal size of the centre port / valve opening, in scene units.
   * Used as the radius of the extruded port geometry.
   */
  portSize: number;

  /** Material classification used to select PBR shading properties. */
  materialType: MaterialType;
}

/**
 * Return type of `extractCADParameters`.
 *
 * `confidence` reflects how many key dimensions were successfully parsed from
 * the source data (0.0 – 1.0).  Values below 0.5 indicate that multiple
 * fallback defaults were applied and the geometry may not accurately represent
 * the physical part.
 */
export interface CADMapperResult {
  /** Normalised parameters ready for direct consumption by the 3D viewer. */
  parameters: CADParameters;

  /**
   * Fractional confidence in the completeness of the mapping.
   * - 1.0  → all five key dimensions found in the spec
   * - 0.0  → no recognisable dimensional data; all values are defaults
   */
  confidence: number;

  /**
   * Human-readable list of which dimensions were parsed successfully vs.
   * filled with defaults.  Useful for the UI legend / tooltip.
   */
  resolvedFields: Partial<Record<keyof Omit<CADParameters, "materialType">, boolean>>;
}
