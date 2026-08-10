import { gangSheetConfigurationSchema, individualDesignsConfigurationSchema, workingOrderConfigurationSchema } from "@/lib/order-draft/schemas";
import type { GangSheetConfiguration, IndividualDesignsConfiguration, OrderRoute, WorkingGangSheetConfiguration, WorkingIndividualDesignsConfiguration } from "@/lib/order-draft/types";
import { DEFAULT_LAYOUT_MODE } from "@/lib/gang-sheet-layout/constants";

const defaultWorkingLayoutPreferences = () => ({ mode: DEFAULT_LAYOUT_MODE, spacingPreset: "standard" as const, customSpacing: "" });

export function createWorkingDesign(artworkId: string) {
  return { artworkId, sizes: [{ id: crypto.randomUUID(), method: "" as const, dimension: "", quantity: "1" }], wantsChanges: "" as const, changeInstructions: "" };
}

export function createWorkingGangSheet(artworkId: string) {
  return { artworkId, copies: "1", finishedWidth: "", finishedLength: "" };
}

export function addWorkingArtwork(configuration: unknown, route: "individual-designs", artworkId: string): WorkingIndividualDesignsConfiguration;
export function addWorkingArtwork(configuration: unknown, route: "gang-sheet", artworkId: string): WorkingGangSheetConfiguration;
export function addWorkingArtwork(configuration: unknown, route: OrderRoute, artworkId: string): WorkingGangSheetConfiguration | WorkingIndividualDesignsConfiguration;
export function addWorkingArtwork(configuration: unknown, route: OrderRoute, artworkId: string) {
  const parsed = workingOrderConfigurationSchema.safeParse(configuration);
  if (route === "gang-sheet") {
    const current = parsed.success && parsed.data.route === route ? parsed.data : { route, sheets: [], notes: "" };
    return current.sheets.some((sheet) => sheet.artworkId === artworkId) ? current : { ...current, sheets: [...current.sheets, createWorkingGangSheet(artworkId)] };
  }
  const current = parsed.success && parsed.data.route === route ? parsed.data : { route, designs: [], layoutPreferences: defaultWorkingLayoutPreferences(), notes: "" };
  return current.designs.some((design) => design.artworkId === artworkId) ? current : { ...current, designs: [...current.designs, createWorkingDesign(artworkId)] };
}

export function pruneArtworkConfiguration(configuration: unknown, artworkId: string) {
  const working = workingOrderConfigurationSchema.safeParse(configuration);
  if (working.success && working.data.route === "individual-designs") {
    return { ...working.data, designs: working.data.designs.filter((design) => design.artworkId !== artworkId) };
  }
  if (working.success && working.data.route === "gang-sheet") {
    return { ...working.data, sheets: working.data.sheets.filter((sheet) => sheet.artworkId !== artworkId) };
  }
  const completed = individualDesignsConfigurationSchema.safeParse(configuration);
  if (completed.success) {
    const designs = completed.data.designs.filter((design) => design.artworkId !== artworkId);
    return designs.length ? { ...completed.data, designs } : null;
  }
  const completedGangSheet = gangSheetConfigurationSchema.safeParse(configuration);
  if (completedGangSheet.success) {
    const sheets = completedGangSheet.data.sheets.filter((sheet) => sheet.artworkId !== artworkId);
    return sheets.length ? { ...completedGangSheet.data, sheets } : null;
  }
  return configuration;
}

export function rebindArtworkConfiguration(configuration: unknown, previousArtworkId: string, nextArtworkId: string) {
  if (configuration === null) return null;
  const working = workingOrderConfigurationSchema.safeParse(configuration);
  if (working.success && working.data.route === "individual-designs") {
    return { ...working.data, designs: working.data.designs.map((design) => design.artworkId === previousArtworkId ? { ...design, artworkId: nextArtworkId } : design) };
  }
  if (working.success && working.data.route === "gang-sheet") {
    return { ...working.data, sheets: working.data.sheets.map((sheet) => sheet.artworkId === previousArtworkId ? { ...sheet, artworkId: nextArtworkId } : sheet) };
  }
  const completed = individualDesignsConfigurationSchema.safeParse(configuration);
  if (completed.success) {
    return { ...completed.data, designs: completed.data.designs.map((design) => design.artworkId === previousArtworkId ? { ...design, artworkId: nextArtworkId } : design) } satisfies IndividualDesignsConfiguration;
  }
  const completedGangSheet = gangSheetConfigurationSchema.safeParse(configuration);
  if (completedGangSheet.success) {
    return { ...completedGangSheet.data, sheets: completedGangSheet.data.sheets.map((sheet) => sheet.artworkId === previousArtworkId ? { ...sheet, artworkId: nextArtworkId } : sheet) } satisfies GangSheetConfiguration;
  }
  return configuration;
}
