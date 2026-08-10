import { describe, expect, it } from "vitest";
import {
  calculateGangSheetLayouts,
  inchesToLayoutUnits,
  layoutUnitsToInches,
  validateSuccessfulLayout,
} from "@/lib/gang-sheet-layout/engine";
import { MAX_LIVE_LAYOUT_PLACEMENTS, SPACING_PRESETS } from "@/lib/gang-sheet-layout/constants";
import type { GangSheetLayout, LayoutVariantInput } from "@/lib/gang-sheet-layout/types";
import { resolveLayoutVariants } from "@/lib/gang-sheet-layout/geometry";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

const variant = (overrides: Partial<LayoutVariantInput> = {}): LayoutVariantInput => ({
  artworkId: "artwork-a",
  artworkName: "Artwork A",
  variantId: "variant-a",
  variantLabel: "Requested size 1",
  quantity: 1,
  widthInches: 10,
  heightInches: 5,
  ...overrides,
});

const calculate = (variants: LayoutVariantInput[], spacingInches = 0.25) => calculateGangSheetLayouts({ variants, spacingInches });
const successful = (layout: GangSheetLayout) => {
  expect(layout.status).toBe("success");
  expect(validateSuccessfulLayout(layout)).toEqual([]);
  return layout;
};

describe("fixed-point gang-sheet layout", () => {
  it("converts decimal inches deterministically at 1/1000 inch", () => {
    expect(inchesToLayoutUnits(22)).toBe(22000);
    expect(inchesToLayoutUnits(0.125)).toBe(125);
    expect(layoutUnitsToInches(11501)).toBe(11.501);
  });

  it("places one rectangle without trailing spacing", () => {
    const layout = successful(calculate([variant()]).efficient);
    expect(layout.sheetWidth).toBe(22);
    expect(layout.usedLength).toBe(5);
    expect(layout.placements).toHaveLength(1);
  });

  it("preserves exact quantities and stable copy identities", () => {
    const layout = successful(calculate([variant({ quantity: 12 })]).efficient);
    expect(layout.placements).toHaveLength(12);
    expect(layout.placements.map((item) => item.copyNumber).sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
  });

  it("packs multiple different rectangles inside the sheet", () => {
    const layout = successful(calculate([
      variant({ widthInches: 11, heightInches: 4, quantity: 2 }),
      variant({ artworkId: "artwork-b", variantId: "variant-b", widthInches: 5, heightInches: 7, quantity: 3 }),
    ]).efficient);
    expect(layout.placements).toHaveLength(5);
  });

  it("allows an exact 22-inch fit and a rounded near-boundary fit", () => {
    expect(successful(calculate([variant({ widthInches: 22, heightInches: 2 })], 0.125).efficient).placements[0].width).toBe(22);
    expect(successful(calculate([variant({ widthInches: 21.9996, heightInches: 2 })]).efficient).placements[0].width).toBe(22);
  });

  it.each(Object.values(SPACING_PRESETS))("respects preset spacing %s exactly", (spacing) => {
    const layout = successful(calculate([variant({ widthInches: 10, heightInches: 3, quantity: 2 })], spacing).efficient);
    const [a, b] = layout.placements;
    const horizontalGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
    const verticalGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
    expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(spacing);
  });

  it("uses custom spacing once, not twice, and excludes trailing spacing", () => {
    const layout = successful(calculate([variant({ widthInches: 10, heightInches: 4, quantity: 2 })], 0.333).efficient);
    expect(layout.placements[1].x - (layout.placements[0].x + layout.placements[0].width)).toBeCloseTo(0.333, 6);
    expect(layout.usedLength).toBe(4);
  });

  it("changing spacing can increase required length", () => {
    const items = [variant({ widthInches: 10.9, heightInches: 4, quantity: 2 })];
    expect(successful(calculate(items, 0.125).efficient).usedLength).toBeLessThan(successful(calculate(items, 0.5).efficient).usedLength!);
  });

  it("rotates when doing so reduces sheet length", () => {
    const layout = successful(calculate([variant({ widthInches: 12, heightInches: 8, quantity: 2 })]).efficient);
    expect(layout.placements.some((placement) => placement.rotation === 90)).toBe(true);
    expect(layout.usedLength).toBeLessThan(16.25);
  });

  it("rotates an otherwise width-incompatible transfer without stretching", () => {
    const layout = successful(calculate([variant({ widthInches: 24, heightInches: 10 })]).efficient);
    expect(layout.placements[0]).toMatchObject({ width: 10, height: 24, sourceWidth: 24, sourceHeight: 10, rotation: 90 });
  });

  it("keeps square orientation deterministic", () => {
    const layout = successful(calculate([variant({ widthInches: 5, heightInches: 5, quantity: 3 })]).efficient);
    expect(layout.placements.every((placement) => placement.rotation === 0)).toBe(true);
  });

  it("returns an oversize diagnostic rather than shrinking", () => {
    const comparison = calculate([variant({ widthInches: 23, heightInches: 24 })]);
    expect(comparison.efficient.status).toBe("incomplete");
    expect(comparison.efficient.diagnostics[0].code).toBe("oversize-item");
    expect(comparison.efficient.usedLength).toBeNull();
  });

  it("returns honest unresolved geometry diagnostics", () => {
    const comparison = calculate([variant({ widthInches: null, heightInches: null, unresolvedReason: "Original Size is unresolved." })]);
    expect(comparison.efficient.diagnostics[0]).toMatchObject({ code: "geometry-unavailable", artworkId: "artwork-a", variantId: "variant-a" });
    expect(comparison.efficient.placements).toEqual([]);
  });

  it("keeps multiple variants of one artwork in one grouped band", () => {
    const grouped = successful(calculate([
      variant({ variantId: "small", widthInches: 4, heightInches: 3, quantity: 4 }),
      variant({ variantId: "large", widthInches: 9, heightInches: 6, quantity: 2 }),
      variant({ artworkId: "artwork-b", artworkName: "Artwork B", variantId: "b", widthInches: 5, heightInches: 5, quantity: 2 }),
    ]).grouped);
    expect(grouped.groups.map((group) => group.artworkId)).toEqual(["artwork-a", "artwork-b"]);
    const aBand = grouped.groups[0];
    expect(grouped.placements.filter((item) => item.artworkId === "artwork-a").every((item) => item.y >= aBand.y && item.y + item.height <= aBand.y + aBand.height)).toBe(true);
  });

  it("makes grouped bands contiguous, ordered, and non-interleaving", () => {
    const grouped = successful(calculate([
      variant({ artworkId: "z", artworkName: "Z", quantity: 2 }),
      variant({ artworkId: "a", artworkName: "A", variantId: "a", quantity: 2 }),
      variant({ artworkId: "m", artworkName: "M", variantId: "m", quantity: 2 }),
    ]).grouped);
    expect(grouped.groups.map((group) => group.artworkId)).toEqual(["z", "a", "m"]);
    for (let index = 1; index < grouped.groups.length; index += 1) {
      expect(grouped.groups[index].y).toBe(grouped.groups[index - 1].y + grouped.groups[index - 1].height + grouped.spacing);
    }
  });

  it("is deterministic for identical input", () => {
    const items = [variant({ quantity: 7 }), variant({ artworkId: "b", variantId: "b", widthInches: 3.75, heightInches: 8.125, quantity: 5 })];
    expect(calculate(items)).toEqual(calculate(items));
  });

  it("defensively guarantees efficient length never exceeds grouped length", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const items = Array.from({ length: 3 }, (_, index) => variant({ artworkId: `art-${index}`, variantId: `v-${index}`, widthInches: 2 + ((seed * (index + 3)) % 13), heightInches: 2 + ((seed * (index + 5)) % 9), quantity: 1 + ((seed + index) % 5) }));
      const result = calculate(items, 0.125 + (seed % 3) * 0.125);
      expect(successful(result.efficient).usedLength).toBeLessThanOrEqual(successful(result.grouped).usedLength!);
      expect(result.difference).toBe(result.grouped.usedLength! - result.efficient.usedLength!);
    }
  });

  it("uses gap-filling candidates that can mix artwork", () => {
    const efficient = successful(calculate([
      variant({ artworkId: "a", variantId: "wide", widthInches: 14, heightInches: 8, quantity: 2 }),
      variant({ artworkId: "b", variantId: "narrow", widthInches: 7, heightInches: 4, quantity: 4 }),
    ]).efficient);
    expect(new Set(efficient.placements.slice(0, 3).map((item) => item.artworkId)).size).toBeGreaterThan(1);
  });

  it("supports the exact placement limit interactively", () => {
    const started = performance.now();
    const layout = successful(calculate([variant({ widthInches: 1, heightInches: 1, quantity: MAX_LIVE_LAYOUT_PLACEMENTS })]).efficient);
    expect(layout.placements).toHaveLength(MAX_LIVE_LAYOUT_PLACEMENTS);
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it("returns before expansion above the placement limit", () => {
    const started = performance.now();
    const result = calculate([variant({ quantity: MAX_LIVE_LAYOUT_PLACEMENTS + 1 })]);
    expect(result.efficient.diagnostics.some((item) => item.code === "layout-too-large-for-live-preview")).toBe(true);
    expect(result.efficient.placements).toHaveLength(0);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it("rejects invalid spacing as a structured diagnostic", () => {
    expect(calculate([variant()], 0).efficient.diagnostics[0].code).toBe("invalid-spacing");
    expect(calculate([variant()], 6).efficient.diagnostics[0].code).toBe("invalid-spacing");
  });
});

describe("layout geometry resolution", () => {
  const artwork = [{ id: "00000000-0000-4000-8000-000000000001", originalName: "wide.png", extension: "png" }] as CanonicalArtworkRecord[];
  const baseConfiguration = { route: "individual-designs" as const, layoutPreferences: { mode: "efficient" as const, spacingPreset: "standard" as const, customSpacing: "" }, notes: "", designs: [{ artworkId: artwork[0].id, wantsChanges: "no" as const, changeInstructions: "", sizes: [{ id: "width", method: "width" as const, dimension: "10", quantity: "2" }, { id: "height", method: "height" as const, dimension: "3", quantity: "1" }, { id: "original", method: "original" as const, dimension: "", quantity: "1" }] }] };

  it("uses intrinsic raster ratio for width and height modes without treating pixels as inches", () => {
    const resolved = resolveLayoutVariants(baseConfiguration, artwork, new Map([[artwork[0].id, { widthPixels: 2000, heightPixels: 1000 }]]));
    expect(resolved[0]).toMatchObject({ widthInches: 10, heightInches: 5 });
    expect(resolved[1]).toMatchObject({ widthInches: 6, heightInches: 3 });
  });

  it("leaves original size unresolved even when pixels are known", () => {
    const resolved = resolveLayoutVariants(baseConfiguration, artwork, new Map([[artwork[0].id, { widthPixels: 2000, heightPixels: 1000 }]]));
    expect(resolved[2]).toMatchObject({ widthInches: null, heightInches: null });
    expect(resolved[2].unresolvedReason).toMatch(/not converted to inches/i);
  });

  it("reports unavailable raster or non-raster aspect ratio without fabrication", () => {
    const unresolved = resolveLayoutVariants(baseConfiguration, artwork, new Map());
    expect(unresolved[0].unresolvedReason).toMatch(/aspect ratio is unavailable/i);
  });
});
