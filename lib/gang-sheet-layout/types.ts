export type LayoutMode = "efficient" | "grouped";
export type SpacingPreset = "tight" | "standard" | "extra" | "custom";

export type LayoutPreferences = {
  mode: LayoutMode;
  spacing: number;
};

export type WorkingLayoutPreferences = {
  mode: LayoutMode;
  spacingPreset: SpacingPreset;
  customSpacing: string;
};

export type LayoutVariantInput = {
  artworkId: string;
  artworkName: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  widthInches: number | null;
  heightInches: number | null;
  unresolvedReason?: string;
};

export type LayoutDiagnosticCode =
  | "no-designs"
  | "incomplete-configuration"
  | "geometry-unavailable"
  | "oversize-item"
  | "invalid-spacing"
  | "layout-too-large-for-live-preview"
  | "engine-failure";

export type LayoutDiagnostic = {
  code: LayoutDiagnosticCode;
  message: string;
  artworkId?: string;
  artworkName?: string;
  variantId?: string;
  variantLabel?: string;
};

export type LayoutPlacement = {
  id: string;
  artworkId: string;
  artworkName: string;
  variantId: string;
  variantLabel: string;
  copyNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  rotation: 0 | 90;
};

export type LayoutGroupBand = {
  artworkId: string;
  artworkName: string;
  y: number;
  height: number;
};

export type GangSheetLayout = {
  status: "success" | "incomplete";
  mode: LayoutMode;
  sheetWidth: number;
  usedLength: number | null;
  spacing: number;
  edgeMargin: number;
  totalRequestedPlacements: number;
  placements: LayoutPlacement[];
  groups: LayoutGroupBand[];
  diagnostics: LayoutDiagnostic[];
  unresolvedItems: LayoutDiagnostic[];
  oversizeItems: LayoutDiagnostic[];
  signature: string;
};

export type GangSheetLayoutComparison = {
  efficient: GangSheetLayout;
  grouped: GangSheetLayout;
  difference: number | null;
};

export type LayoutRequest = {
  variants: LayoutVariantInput[];
  spacingInches: number;
  edgeMarginInches?: number;
  maxPlacements?: number;
};
