export const LAYOUT_UNITS_PER_INCH = 1000;
export const GANG_SHEET_WIDTH_INCHES = 22;
export const DEFAULT_EDGE_MARGIN_INCHES = 0;

export const SPACING_PRESETS = {
  tight: 0.125,
  standard: 0.25,
  extra: 0.5,
} as const;

export const DEFAULT_LAYOUT_MODE = "efficient" as const;
export const DEFAULT_SPACING_INCHES = SPACING_PRESETS.standard;
export const MIN_CUSTOM_SPACING_INCHES = 0.001;
export const MAX_CUSTOM_SPACING_INCHES = 5;

// Exact previews deliberately stop before expansion can create an expensive
// packing pass or an unusably large SVG. Configuration remains valid above it.
export const MAX_LIVE_LAYOUT_PLACEMENTS = 1000;
export const MAX_STRONG_HEURISTIC_PLACEMENTS = 200;
