import {
  DEFAULT_EDGE_MARGIN_INCHES,
  GANG_SHEET_WIDTH_INCHES,
  LAYOUT_UNITS_PER_INCH,
  MAX_CUSTOM_SPACING_INCHES,
  MAX_LIVE_LAYOUT_PLACEMENTS,
  MAX_STRONG_HEURISTIC_PLACEMENTS,
  MIN_CUSTOM_SPACING_INCHES,
} from "@/lib/gang-sheet-layout/constants";
import type {
  GangSheetLayout,
  GangSheetLayoutComparison,
  LayoutDiagnostic,
  LayoutGroupBand,
  LayoutMode,
  LayoutPlacement,
  LayoutRequest,
  LayoutVariantInput,
} from "@/lib/gang-sheet-layout/types";

type UnitPlacement = Omit<LayoutPlacement, "x" | "y" | "width" | "height" | "sourceWidth" | "sourceHeight"> & {
  x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number;
};
type UnitGroup = Omit<LayoutGroupBand, "y" | "height"> & { y: number; height: number };
type UnitItem = Omit<UnitPlacement, "x" | "y" | "width" | "height" | "rotation"> & { width: number; height: number };
type Candidate = { placements: UnitPlacement[]; groups: UnitGroup[]; usedLength: number; signature: string };
type OrderStrategy = "area" | "largest-side" | "height" | "width";

export function inchesToLayoutUnits(inches: number) {
  return Math.round(inches * LAYOUT_UNITS_PER_INCH);
}

export function layoutUnitsToInches(units: number) {
  return units / LAYOUT_UNITS_PER_INCH;
}

export function calculateGangSheetLayouts(request: LayoutRequest): GangSheetLayoutComparison {
  const sheetWidth = inchesToLayoutUnits(GANG_SHEET_WIDTH_INCHES);
  const spacing = inchesToLayoutUnits(request.spacingInches);
  const edgeMargin = inchesToLayoutUnits(request.edgeMarginInches ?? DEFAULT_EDGE_MARGIN_INCHES);
  const maxPlacements = request.maxPlacements ?? MAX_LIVE_LAYOUT_PLACEMENTS;
  const total = request.variants.reduce((sum, variant) => Number.isSafeInteger(variant.quantity) && variant.quantity > 0 ? sum + variant.quantity : sum, 0);
  const diagnostics = validateRequest(request.variants, request.spacingInches, edgeMargin, sheetWidth, total, maxPlacements);
  if (diagnostics.length > 0) {
    return comparisonFromDiagnostics(sheetWidth, spacing, edgeMargin, total, diagnostics);
  }

  try {
    const instances = expandVariants(request.variants);
    const usableWidth = sheetWidth - edgeMargin * 2;
    const groupedCandidate = packGrouped(instances, usableWidth, spacing);
    const efficientCandidate = chooseCandidate([
      ...packCandidates(instances, usableWidth, spacing),
      { ...groupedCandidate, groups: [] },
    ]);
    const efficient = toLayout("efficient", efficientCandidate, sheetWidth, spacing, edgeMargin, total);
    const grouped = toLayout("grouped", groupedCandidate, sheetWidth, spacing, edgeMargin, total);
    return {
      efficient,
      grouped,
      difference: layoutUnitsToInches(groupedCandidate.usedLength - efficientCandidate.usedLength),
    };
  } catch {
    return comparisonFromDiagnostics(sheetWidth, spacing, edgeMargin, total, [{ code: "engine-failure", message: "The layout preview could not be generated. Your configuration is still available to edit." }]);
  }
}

function validateRequest(variants: LayoutVariantInput[], spacingInches: number, edgeMargin: number, sheetWidth: number, total: number, maxPlacements: number) {
  const diagnostics: LayoutDiagnostic[] = [];
  if (variants.length === 0) diagnostics.push({ code: "no-designs", message: "Add and configure artwork to generate a layout." });
  if (!Number.isFinite(spacingInches) || spacingInches < MIN_CUSTOM_SPACING_INCHES || spacingInches > MAX_CUSTOM_SPACING_INCHES) {
    diagnostics.push({ code: "invalid-spacing", message: `Spacing must be between ${MIN_CUSTOM_SPACING_INCHES} and ${MAX_CUSTOM_SPACING_INCHES} inches.` });
  }
  for (const variant of variants) {
    if (!Number.isSafeInteger(variant.quantity) || variant.quantity < 1) {
      diagnostics.push(diagnosticFor(variant, "incomplete-configuration", "Enter a whole-number quantity before generating this layout."));
      continue;
    }
    if (variant.unresolvedReason || !isPositiveFinite(variant.widthInches) || !isPositiveFinite(variant.heightInches)) {
      diagnostics.push(diagnosticFor(variant, "geometry-unavailable", variant.unresolvedReason ?? "Both physical dimensions are required for layout."));
      continue;
    }
    const width = inchesToLayoutUnits(variant.widthInches);
    const height = inchesToLayoutUnits(variant.heightInches);
    const usableWidth = sheetWidth - edgeMargin * 2;
    if (Math.min(width, height) > usableWidth) {
      diagnostics.push(diagnosticFor(variant, "oversize-item", `Neither 0° nor 90° orientation fits the usable ${GANG_SHEET_WIDTH_INCHES}-inch sheet width.`));
    }
  }
  if (total > maxPlacements) diagnostics.push({ code: "layout-too-large-for-live-preview", message: `This request contains ${total} transfers. Live exact preview supports up to ${maxPlacements}; quantities were not reduced.` });
  return diagnostics;
}

function diagnosticFor(variant: LayoutVariantInput, code: LayoutDiagnostic["code"], message: string): LayoutDiagnostic {
  return { code, message, artworkId: variant.artworkId, artworkName: variant.artworkName, variantId: variant.variantId, variantLabel: variant.variantLabel };
}

function comparisonFromDiagnostics(sheetWidth: number, spacing: number, edgeMargin: number, total: number, diagnostics: LayoutDiagnostic[]): GangSheetLayoutComparison {
  const make = (mode: LayoutMode): GangSheetLayout => ({ status: "incomplete", mode, sheetWidth: layoutUnitsToInches(sheetWidth), usedLength: null, spacing: layoutUnitsToInches(spacing), edgeMargin: layoutUnitsToInches(edgeMargin), totalRequestedPlacements: total, placements: [], groups: [], diagnostics, unresolvedItems: diagnostics.filter((item) => item.code === "geometry-unavailable" || item.code === "incomplete-configuration"), oversizeItems: diagnostics.filter((item) => item.code === "oversize-item"), signature: `${mode}:incomplete:${diagnostics.map((item) => item.code).join(",")}` });
  return { efficient: make("efficient"), grouped: make("grouped"), difference: null };
}

function expandVariants(variants: LayoutVariantInput[]): UnitItem[] {
  return variants.flatMap((variant) => {
    const width = inchesToLayoutUnits(variant.widthInches!);
    const height = inchesToLayoutUnits(variant.heightInches!);
    return Array.from({ length: variant.quantity }, (_, index) => ({
      id: `${variant.artworkId}:${variant.variantId}:${index + 1}`,
      artworkId: variant.artworkId,
      artworkName: variant.artworkName,
      variantId: variant.variantId,
      variantLabel: variant.variantLabel,
      copyNumber: index + 1,
      width,
      height,
      sourceWidth: width,
      sourceHeight: height,
    }));
  });
}

function packGrouped(items: UnitItem[], usableWidth: number, spacing: number): Candidate {
  const artworkOrder = [...new Set(items.map((item) => item.artworkId))];
  const placements: UnitPlacement[] = [];
  const groups: UnitGroup[] = [];
  let offsetY = 0;
  for (const artworkId of artworkOrder) {
    const groupItems = items.filter((item) => item.artworkId === artworkId);
    const candidate = chooseCandidate(packCandidates(groupItems, usableWidth, spacing));
    placements.push(...candidate.placements.map((placement) => ({ ...placement, y: placement.y + offsetY })));
    groups.push({ artworkId, artworkName: groupItems[0].artworkName, y: offsetY, height: candidate.usedLength });
    offsetY += candidate.usedLength + spacing;
  }
  const usedLength = groups.length ? offsetY - spacing : 0;
  return makeCandidate(placements, groups, usedLength);
}

function packCandidates(items: UnitItem[], usableWidth: number, spacing: number) {
  const strategies: OrderStrategy[] = ["area", "largest-side", "height", "width"];
  return strategies.flatMap((strategy) => {
    const ordered = [...items].sort(orderComparator(strategy));
    const baseline = packShelf(ordered, usableWidth, spacing);
    // The gap-filling bottom-left search is intentionally bounded. Larger
    // requests retain four deterministic shelf candidates and stay interactive.
    return items.length <= MAX_STRONG_HEURISTIC_PLACEMENTS ? [baseline, packBottomLeft(ordered, usableWidth, spacing)] : [baseline];
  });
}

function orderComparator(strategy: OrderStrategy) {
  return (a: UnitItem, b: UnitItem) => {
    const metrics = strategy === "area" ? [b.width * b.height - a.width * a.height]
      : strategy === "largest-side" ? [Math.max(b.width, b.height) - Math.max(a.width, a.height)]
        : strategy === "height" ? [b.height - a.height, b.width - a.width]
          : [b.width - a.width, b.height - a.height];
    return metrics.find((value) => value !== 0) ?? a.id.localeCompare(b.id);
  };
}

function orientations(item: UnitItem, usableWidth: number) {
  const options = [oriented(item, 0), ...(item.width === item.height ? [] : [oriented(item, 90)])];
  return options.filter((option) => option.width <= usableWidth).sort((a, b) => a.rotation - b.rotation);
}

function oriented(item: UnitItem, rotation: 0 | 90): Omit<UnitPlacement, "x" | "y"> {
  return { ...item, width: rotation === 0 ? item.width : item.height, height: rotation === 0 ? item.height : item.width, rotation };
}

function packShelf(items: UnitItem[], usableWidth: number, spacing: number): Candidate {
  const placements: UnitPlacement[] = [];
  let x = 0; let y = 0; let rowHeight = 0;
  for (const item of items) {
    const options = orientations(item, usableWidth);
    const choices = options.map((option) => {
      const fitsRow = x === 0 || x + option.width <= usableWidth;
      const nextY = fitsRow ? y : y + rowHeight + spacing;
      const nextX = fitsRow ? x : 0;
      return { option, x: nextX, y: nextY, used: Math.max(nextY + option.height, y + rowHeight), fitsRow };
    }).sort((a, b) => a.used - b.used || a.y - b.y || a.x - b.x || a.option.rotation - b.option.rotation);
    const choice = choices[0];
    placements.push({ ...choice.option, x: choice.x, y: choice.y });
    if (!choice.fitsRow) rowHeight = 0;
    x = choice.x + choice.option.width + spacing;
    y = choice.y;
    rowHeight = Math.max(rowHeight, choice.option.height);
  }
  return makeCandidate(placements, [], placements.reduce((length, placement) => Math.max(length, placement.y + placement.height), 0));
}

function packBottomLeft(items: UnitItem[], usableWidth: number, spacing: number): Candidate {
  const placements: UnitPlacement[] = [];
  for (const item of items) {
    const points = candidatePoints(placements, spacing);
    const choices = orientations(item, usableWidth).flatMap((option) => points.map((point) => ({ option, ...point })))
      .filter((choice) => choice.x + choice.option.width <= usableWidth && !placements.some((placed) => conflicts(choice.x, choice.y, choice.option.width, choice.option.height, placed, spacing)))
      .sort((a, b) => (a.y + a.option.height) - (b.y + b.option.height) || a.y - b.y || a.x - b.x || a.option.rotation - b.option.rotation);
    const choice = choices[0];
    if (!choice) throw new Error("No valid strip placement found.");
    placements.push({ ...choice.option, x: choice.x, y: choice.y });
  }
  return makeCandidate(placements, [], placements.reduce((length, placement) => Math.max(length, placement.y + placement.height), 0));
}

function candidatePoints(placements: UnitPlacement[], spacing: number) {
  const points = new Map<string, { x: number; y: number }>();
  const add = (x: number, y: number) => points.set(`${x}:${y}`, { x, y });
  add(0, 0);
  for (const placement of placements) {
    add(placement.x + placement.width + spacing, placement.y);
    add(placement.x, placement.y + placement.height + spacing);
    add(0, placement.y + placement.height + spacing);
    add(placement.x + placement.width + spacing, 0);
  }
  return [...points.values()];
}

function conflicts(x: number, y: number, width: number, height: number, other: UnitPlacement, spacing: number) {
  return x < other.x + other.width + spacing && x + width + spacing > other.x
    && y < other.y + other.height + spacing && y + height + spacing > other.y;
}

function chooseCandidate(candidates: Candidate[]) {
  return [...candidates].sort((a, b) => a.usedLength - b.usedLength || a.signature.localeCompare(b.signature))[0];
}

function makeCandidate(placements: UnitPlacement[], groups: UnitGroup[], usedLength: number): Candidate {
  const ordered = [...placements].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  return { placements: ordered, groups, usedLength, signature: ordered.map((placement) => `${placement.id}@${placement.x},${placement.y},${placement.rotation}`).join("|") };
}

function toLayout(mode: LayoutMode, candidate: Candidate, sheetWidth: number, spacing: number, edgeMargin: number, total: number): GangSheetLayout {
  const usedLength = candidate.usedLength + edgeMargin * 2;
  return {
    status: "success", mode, sheetWidth: layoutUnitsToInches(sheetWidth), usedLength: layoutUnitsToInches(usedLength), spacing: layoutUnitsToInches(spacing), edgeMargin: layoutUnitsToInches(edgeMargin), totalRequestedPlacements: total,
    placements: candidate.placements.map((placement) => ({ ...placement, x: layoutUnitsToInches(placement.x + edgeMargin), y: layoutUnitsToInches(placement.y + edgeMargin), width: layoutUnitsToInches(placement.width), height: layoutUnitsToInches(placement.height), sourceWidth: layoutUnitsToInches(placement.sourceWidth), sourceHeight: layoutUnitsToInches(placement.sourceHeight) })),
    groups: candidate.groups.map((group) => ({ ...group, y: layoutUnitsToInches(group.y + edgeMargin), height: layoutUnitsToInches(group.height) })),
    diagnostics: [], unresolvedItems: [], oversizeItems: [], signature: `${mode}:${usedLength}:${candidate.signature}`,
  };
}

function isPositiveFinite(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateSuccessfulLayout(layout: GangSheetLayout) {
  const errors: string[] = [];
  if (layout.status !== "success" || layout.usedLength === null) return ["Layout is not successful."];
  for (const placement of layout.placements) {
    if (placement.x < layout.edgeMargin || placement.y < layout.edgeMargin) errors.push(`${placement.id} starts outside the sheet boundary.`);
    if (placement.x + placement.width > layout.sheetWidth - layout.edgeMargin + 1 / LAYOUT_UNITS_PER_INCH) errors.push(`${placement.id} exceeds sheet width.`);
    if (placement.rotation !== 0 && placement.rotation !== 90) errors.push(`${placement.id} has invalid rotation.`);
  }
  for (let left = 0; left < layout.placements.length; left += 1) {
    for (let right = left + 1; right < layout.placements.length; right += 1) {
      const a = layout.placements[left]; const b = layout.placements[right];
      const separated = a.x + a.width + layout.spacing <= b.x + 1e-9 || b.x + b.width + layout.spacing <= a.x + 1e-9 || a.y + a.height + layout.spacing <= b.y + 1e-9 || b.y + b.height + layout.spacing <= a.y + 1e-9;
      if (!separated) errors.push(`${a.id} and ${b.id} overlap or violate spacing.`);
    }
  }
  return errors;
}
