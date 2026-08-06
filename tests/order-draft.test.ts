import { describe, expect, it } from "vitest";
import { MAX_DYNAMIC_ROWS, ORDER_ROUTE_VALUES } from "../lib/order-draft/constants";
import { getEarliestIncompleteStep, getGuardRedirect, parseOrderRouteQuery } from "../lib/order-draft/navigation";
import { gangSheetConfigurationSchema, individualDesignsConfigurationSchema, individualDesignsFormSchema, orderConfigurationSchema } from "../lib/order-draft/schemas";
import { createOrderDraftStore } from "../lib/order-draft/store";
import { formatConfigurationSummary } from "../lib/order-draft/summary";
import { migrateLegacyRoute } from "../lib/order-draft/legacy-migration";
import { pruneArtworkConfiguration, rebindArtworkConfiguration } from "../lib/order-draft/artwork-configuration";
import type { IndividualDesignsConfiguration, WorkingOrderConfiguration } from "../lib/order-draft/types";

const artworkA = "00000000-0000-4000-8000-000000000001";
const artworkB = "00000000-0000-4000-8000-000000000002";
const gangSheet = { route: "gang-sheet" as const, sheetCount: 2, finishedWidth: 22, finishedLength: 36, notes: "Local launch" };
const individual: IndividualDesignsConfiguration = {
  route: "individual-designs",
  designs: [{ artworkId: artworkA, sizes: [
    { id: "size-width", method: "width", width: 11, quantity: 10 },
    { id: "size-height", method: "height", height: 8, quantity: 4 },
    { id: "size-original", method: "original", quantity: 2 },
  ], wantsChanges: true, changeInstructions: "Remove the background." }],
  notes: "",
};

describe("two-route product model", () => {
  it("exposes exactly two active routes and rejects legacy routes", () => {
    expect(ORDER_ROUTE_VALUES).toEqual(["gang-sheet", "individual-designs"]);
    expect(parseOrderRouteQuery("individual-designs")).toBe("individual-designs");
    for (const legacy of ["separate-artwork", "transfers-by-size", "full-apparel"]) expect(parseOrderRouteQuery(legacy)).toBeNull();
  });

  it("maps historical routes deterministically for the SQL migration", () => {
    expect(migrateLegacyRoute("gang-sheet")).toBe("gang-sheet");
    expect(migrateLegacyRoute("separate-artwork")).toBe("individual-designs");
    expect(migrateLegacyRoute("transfers-by-size")).toBe("individual-designs");
    expect(migrateLegacyRoute("full-apparel")).toBe("individual-designs");
  });
});

describe("route configuration schemas", () => {
  it("keeps gang-sheet configuration valid and bounded", () => {
    expect(gangSheetConfigurationSchema.safeParse(gangSheet).success).toBe(true);
    expect(gangSheetConfigurationSchema.safeParse({ ...gangSheet, sheetCount: 1.5 }).success).toBe(false);
    expect(gangSheetConfigurationSchema.safeParse({ ...gangSheet, finishedWidth: 0 }).success).toBe(false);
  });

  it("accepts multiple designs and multiple mutually exclusive size variants", () => {
    const multiple = { ...individual, designs: [...individual.designs, { ...individual.designs[0], artworkId: artworkB }] };
    expect(individualDesignsConfigurationSchema.safeParse(multiple).success).toBe(true);
    expect(orderConfigurationSchema.safeParse(multiple).success).toBe(true);
  });

  it("rejects invalid sizing combinations, quantities, and duplicate identities", () => {
    const base = individual.designs[0];
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...base, sizes: [{ id: "x", method: "width", width: 5, height: 6, quantity: 1 }] }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...base, sizes: [{ id: "x", method: "height", height: 5, width: 6, quantity: 1 }] }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...base, sizes: [{ id: "x", method: "original", width: 5, quantity: 1 }] }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...base, sizes: [{ id: "x", method: "width", width: 5, quantity: 0 }] }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...base, sizes: Array.from({ length: MAX_DYNAMIC_ROWS + 1 }, (_, i) => ({ id: `x-${i}`, method: "original" as const, quantity: 1 })) }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [base, base] }).success).toBe(false);
  });

  it("requires meaningful instructions only when changes are requested", () => {
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...individual.designs[0], changeInstructions: "   " }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...individual.designs[0], wantsChanges: false, changeInstructions: "crop" }] }).success).toBe(false);
    expect(individualDesignsConfigurationSchema.safeParse({ ...individual, designs: [{ ...individual.designs[0], wantsChanges: false, changeInstructions: "" }] }).success).toBe(true);
  });

  it("preserves incomplete working values and transforms valid form values", () => {
    const working = { route: "individual-designs", designs: [{ artworkId: artworkA, sizes: [{ id: "x", method: "", dimension: "", quantity: "" }], wantsChanges: "", changeInstructions: "" }], notes: "" };
    expect(individualDesignsFormSchema.safeParse(working).success).toBe(false);
    const valid = { ...working, designs: [{ ...working.designs[0], sizes: [{ id: "x", method: "height", dimension: "8.5", quantity: "3" }], wantsChanges: "no" }] };
    expect(individualDesignsFormSchema.parse(valid).designs[0].sizes[0]).toEqual({ id: "x", method: "height", height: 8.5, quantity: 3 });
  });
});

describe("artwork-linked synchronization", () => {
  it("prunes deleted artwork and rebinds replacements without losing details", () => {
    const multiple = { ...individual, designs: [...individual.designs, { ...individual.designs[0], artworkId: artworkB }] };
    expect((pruneArtworkConfiguration(multiple, artworkA) as IndividualDesignsConfiguration).designs.map((design) => design.artworkId)).toEqual([artworkB]);
    const rebound = rebindArtworkConfiguration(individual, artworkA, artworkB) as IndividualDesignsConfiguration;
    expect(rebound.designs[0]).toMatchObject({ artworkId: artworkB, wantsChanges: true, changeInstructions: "Remove the background." });
    expect(rebound.designs[0].sizes).toEqual(individual.designs[0].sizes);
  });
});

describe("draft navigation and state", () => {
  it("guards forward access and clears incompatible route state", () => {
    const empty = { selectedRoute: null, startingPointConfirmed: false, artworkAcknowledged: false, configuration: null, lastCompletedStep: 0 as const };
    expect(getEarliestIncompleteStep(empty)).toBe("start");
    expect(getGuardRedirect("review", empty)).toBe("/order/start");
    const store = createOrderDraftStore();
    store.getState().selectRoute("gang-sheet");
    store.getState().confirmStartingPoint();
    store.getState().acknowledgeArtwork();
    store.getState().saveConfiguration(gangSheet);
    store.getState().selectRoute("individual-designs");
    expect(store.getState()).toMatchObject({ selectedRoute: "individual-designs", startingPointConfirmed: false, artworkAcknowledged: false, workingConfiguration: null, configuration: null, lastCompletedStep: 0 });
  });

  it("stores incomplete artwork-linked working state without completing details", () => {
    const store = createOrderDraftStore();
    const working: WorkingOrderConfiguration = { route: "individual-designs", designs: [{ artworkId: artworkA, sizes: [{ id: "size", method: "", dimension: "", quantity: "" }], wantsChanges: "", changeInstructions: "" }], notes: "editing" };
    store.getState().selectRoute("individual-designs");
    store.getState().confirmStartingPoint();
    store.getState().acknowledgeArtwork();
    store.getState().saveWorkingConfiguration(working);
    expect(store.getState().configuration).toBeNull();
    expect(getGuardRedirect("review", store.getState())).toBe("/order/configure");
    store.getState().saveConfiguration(individual);
    expect(getGuardRedirect("review", store.getState())).toBeNull();
  });
});

describe("review summary formatting", () => {
  it("identifies designs by original filename without pricing", () => {
    const summary = formatConfigurationSummary(individual, [{ id: artworkA, originalName: "front-logo.png" } as never]);
    expect(summary[0].title).toBe("front-logo.png");
    expect(JSON.stringify(summary)).toContain("Set by width: 11 in");
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("price");
  });
});
