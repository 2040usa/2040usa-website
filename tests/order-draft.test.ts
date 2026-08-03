import { describe, expect, it } from "vitest";
import { MAX_DYNAMIC_ROWS } from "../lib/order-draft/constants";
import { getEarliestIncompleteStep, getGuardRedirect, parseOrderRouteQuery } from "../lib/order-draft/navigation";
import {
  fullApparelConfigurationSchema,
  gangSheetConfigurationSchema,
  orderConfigurationSchema,
  separateArtworkConfigurationSchema,
  transfersBySizeConfigurationSchema,
} from "../lib/order-draft/schemas";
import { createOrderDraftStore } from "../lib/order-draft/store";
import { formatConfigurationSummary } from "../lib/order-draft/summary";
import type { WorkingOrderConfiguration } from "../lib/order-draft/types";

const gangSheet = { route: "gang-sheet" as const, sheetCount: 2, finishedWidth: 22, finishedLength: 36, notes: "Local launch" };

describe("order route query parsing", () => {
  it("accepts only approved route slugs", () => {
    expect(parseOrderRouteQuery("separate-artwork")).toBe("separate-artwork");
    expect(parseOrderRouteQuery("checkout")).toBeNull();
    expect(parseOrderRouteQuery(["gang-sheet"])).toBeNull();
    expect(parseOrderRouteQuery(undefined)).toBeNull();
  });
});

describe("route-specific configuration schemas", () => {
  it("validates print-ready gang sheets", () => {
    expect(gangSheetConfigurationSchema.safeParse(gangSheet).success).toBe(true);
    expect(gangSheetConfigurationSchema.safeParse({ ...gangSheet, sheetCount: 1.5 }).success).toBe(false);
    expect(gangSheetConfigurationSchema.safeParse({ ...gangSheet, finishedWidth: 0 }).success).toBe(false);
  });

  it("validates separate artwork rows and unique stable IDs", () => {
    const valid = { route: "separate-artwork" as const, designs: [{ id: "design-a", label: "Front", width: 11, quantity: 10 }], notes: "" };
    expect(separateArtworkConfigurationSchema.safeParse(valid).success).toBe(true);
    expect(separateArtworkConfigurationSchema.safeParse({ ...valid, designs: [] }).success).toBe(false);
    expect(separateArtworkConfigurationSchema.safeParse({ ...valid, designs: [valid.designs[0], { ...valid.designs[0], label: "Back" }] }).success).toBe(false);
    expect(separateArtworkConfigurationSchema.safeParse({ ...valid, designs: Array.from({ length: MAX_DYNAMIC_ROWS + 1 }, (_, index) => ({ id: `row-${index}`, label: `Design ${index}`, width: 1, quantity: 1 })) }).success).toBe(false);
  });

  it("validates transfer size rows", () => {
    const valid = { route: "transfers-by-size" as const, designLabel: "Club mark", sizes: [{ id: "size-a", width: 8, quantity: 12 }], notes: "" };
    expect(transfersBySizeConfigurationSchema.safeParse(valid).success).toBe(true);
    expect(transfersBySizeConfigurationSchema.safeParse({ ...valid, sizes: [{ ...valid.sizes[0], quantity: 2.5 }] }).success).toBe(false);
    expect(transfersBySizeConfigurationSchema.safeParse({ ...valid, designLabel: "" }).success).toBe(false);
  });

  it("validates full apparel requirements", () => {
    const valid = { route: "full-apparel" as const, garmentSource: "customer-supplies" as const, projectType: "t-shirts" as const, garmentQuantity: 24, printLocations: ["front" as const], notes: "" };
    expect(fullApparelConfigurationSchema.safeParse(valid).success).toBe(true);
    expect(fullApparelConfigurationSchema.safeParse({ ...valid, printLocations: [] }).success).toBe(false);
    expect(fullApparelConfigurationSchema.safeParse({ ...valid, garmentQuantity: -1 }).success).toBe(false);
    expect(orderConfigurationSchema.safeParse(valid).success).toBe(true);
  });
});

describe("draft navigation and state", () => {
  it("finds the earliest incomplete step and only guards forward access", () => {
    const empty = { selectedRoute: null, startingPointConfirmed: false, artworkAcknowledged: false, configuration: null, lastCompletedStep: 0 as const };
    expect(getEarliestIncompleteStep(empty)).toBe("start");
    expect(getGuardRedirect("review", empty)).toBe("/order/start");
    const preselected = { ...empty, selectedRoute: "gang-sheet" as const };
    expect(getEarliestIncompleteStep(preselected)).toBe("start");
    const selected = { ...preselected, startingPointConfirmed: true, lastCompletedStep: 1 as const };
    expect(getEarliestIncompleteStep(selected)).toBe("artwork");
    expect(getGuardRedirect("start", selected)).toBeNull();
    const acknowledged = { ...selected, artworkAcknowledged: true, lastCompletedStep: 2 as const };
    expect(getGuardRedirect("review", acknowledged)).toBe("/order/configure");
  });

  it("clears incompatible configuration when the route changes and resets fully", () => {
    const store = createOrderDraftStore();
    store.getState().selectRoute("gang-sheet");
    store.getState().confirmStartingPoint();
    store.getState().acknowledgeArtwork();
    store.getState().saveWorkingConfiguration({ route: "gang-sheet", sheetCount: "", finishedWidth: "22", finishedLength: "36", notes: "In progress" });
    store.getState().saveConfiguration(gangSheet);
    expect(store.getState().configuration).toEqual(gangSheet);
    expect(store.getState().workingConfiguration).toEqual({ route: "gang-sheet", sheetCount: "2", finishedWidth: "22", finishedLength: "36", notes: "Local launch" });
    store.getState().selectRoute("separate-artwork");
    expect(store.getState()).toMatchObject({ selectedRoute: "separate-artwork", startingPointConfirmed: false, artworkAcknowledged: false, workingConfiguration: null, configuration: null, lastCompletedStep: 0 });
    store.getState().resetDraft();
    expect(store.getState()).toMatchObject({ selectedRoute: null, startingPointConfirmed: false, artworkAcknowledged: false, workingConfiguration: null, configuration: null, lastCompletedStep: 0 });
  });

  it("stores a discriminated working configuration without completing Project Details", () => {
    const store = createOrderDraftStore();
    const working: WorkingOrderConfiguration = {
      route: "separate-artwork",
      designs: [{ id: "design-working", label: "", width: "11.5", quantity: "" }],
      notes: "Still editing",
    };
    store.getState().selectRoute("separate-artwork");
    store.getState().confirmStartingPoint();
    store.getState().acknowledgeArtwork();
    store.getState().saveWorkingConfiguration(working);

    expect(store.getState().workingConfiguration).toEqual(working);
    expect(store.getState().workingConfiguration?.route).toBe("separate-artwork");
    expect(store.getState().configuration).toBeNull();
    expect(store.getState().lastCompletedStep).toBe(2);
    expect(getGuardRedirect("review", store.getState())).toBe("/order/configure");

    const completed = { route: "separate-artwork" as const, designs: [{ id: "design-working", label: "Front", width: 11.5, quantity: 24 }], notes: "Ready" };
    store.getState().saveConfiguration(completed);
    expect(store.getState().configuration).toEqual(completed);
    expect(store.getState().lastCompletedStep).toBe(3);
    expect(getGuardRedirect("review", store.getState())).toBeNull();
  });
});

describe("review summary formatting", () => {
  it("formats route configuration without pricing or totals", () => {
    const summary = formatConfigurationSummary(gangSheet);
    expect(summary[0].items).toContainEqual({ label: "Finished width", value: "22 in" });
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("price");
    expect(JSON.stringify(summary).toLowerCase()).not.toContain("total");
  });
});
