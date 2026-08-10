import type { GangSheetConfiguration, IndividualDesignsConfiguration, OrderConfiguration, WorkingGangSheetConfiguration, WorkingIndividualDesignsConfiguration, WorkingOrderConfiguration } from "@/lib/order-draft/types";
import { SPACING_PRESETS } from "@/lib/gang-sheet-layout/constants";

export function toWorkingConfiguration(configuration: GangSheetConfiguration): WorkingGangSheetConfiguration;
export function toWorkingConfiguration(configuration: IndividualDesignsConfiguration): WorkingIndividualDesignsConfiguration;
export function toWorkingConfiguration(configuration: OrderConfiguration): WorkingOrderConfiguration;
export function toWorkingConfiguration(configuration: OrderConfiguration): WorkingOrderConfiguration {
  if (configuration.route === "gang-sheet") {
    return { ...configuration, sheets: configuration.sheets.map((sheet) => ({ ...sheet, copies: String(sheet.copies), finishedWidth: String(sheet.finishedWidth), finishedLength: String(sheet.finishedLength) })) };
  }
  return {
    ...configuration,
    layoutPreferences: toWorkingLayoutPreferences(configuration.layoutPreferences),
    designs: configuration.designs.map((design) => ({
      artworkId: design.artworkId,
      wantsChanges: design.wantsChanges ? "yes" : "no",
      changeInstructions: design.changeInstructions,
      sizes: design.sizes.map((size) => ({
        id: size.id,
        method: size.method,
        dimension: size.method === "width" ? String(size.width) : size.method === "height" ? String(size.height) : "",
        quantity: String(size.quantity),
      })),
    })),
  };
}

function toWorkingLayoutPreferences(preferences: IndividualDesignsConfiguration["layoutPreferences"]): WorkingIndividualDesignsConfiguration["layoutPreferences"] {
  const preset = (Object.entries(SPACING_PRESETS) as Array<["tight" | "standard" | "extra", number]>).find(([, value]) => value === preferences.spacing)?.[0];
  return preset
    ? { mode: preferences.mode, spacingPreset: preset, customSpacing: "" }
    : { mode: preferences.mode, spacingPreset: "custom", customSpacing: String(preferences.spacing) };
}
