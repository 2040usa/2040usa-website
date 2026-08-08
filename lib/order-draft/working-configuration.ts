import type { GangSheetConfiguration, IndividualDesignsConfiguration, OrderConfiguration, WorkingGangSheetConfiguration, WorkingIndividualDesignsConfiguration, WorkingOrderConfiguration } from "@/lib/order-draft/types";

export function toWorkingConfiguration(configuration: GangSheetConfiguration): WorkingGangSheetConfiguration;
export function toWorkingConfiguration(configuration: IndividualDesignsConfiguration): WorkingIndividualDesignsConfiguration;
export function toWorkingConfiguration(configuration: OrderConfiguration): WorkingOrderConfiguration;
export function toWorkingConfiguration(configuration: OrderConfiguration): WorkingOrderConfiguration {
  if (configuration.route === "gang-sheet") {
    return { ...configuration, sheets: configuration.sheets.map((sheet) => ({ ...sheet, copies: String(sheet.copies), finishedWidth: String(sheet.finishedWidth), finishedLength: String(sheet.finishedLength) })) };
  }
  return {
    ...configuration,
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
