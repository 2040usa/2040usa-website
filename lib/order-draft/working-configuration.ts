import type {
  FullApparelConfiguration,
  GangSheetConfiguration,
  OrderConfiguration,
  SeparateArtworkConfiguration,
  TransfersBySizeConfiguration,
  WorkingFullApparelConfiguration,
  WorkingGangSheetConfiguration,
  WorkingOrderConfiguration,
  WorkingSeparateArtworkConfiguration,
  WorkingTransfersBySizeConfiguration,
} from "@/lib/order-draft/types";

export function toWorkingConfiguration(configuration: GangSheetConfiguration): WorkingGangSheetConfiguration;
export function toWorkingConfiguration(configuration: SeparateArtworkConfiguration): WorkingSeparateArtworkConfiguration;
export function toWorkingConfiguration(configuration: TransfersBySizeConfiguration): WorkingTransfersBySizeConfiguration;
export function toWorkingConfiguration(configuration: FullApparelConfiguration): WorkingFullApparelConfiguration;
export function toWorkingConfiguration(configuration: OrderConfiguration): WorkingOrderConfiguration;

export function toWorkingConfiguration(configuration: OrderConfiguration): WorkingOrderConfiguration {
  if (configuration.route === "gang-sheet") {
    return {
      ...configuration,
      sheetCount: String(configuration.sheetCount),
      finishedWidth: String(configuration.finishedWidth),
      finishedLength: String(configuration.finishedLength),
    };
  }

  if (configuration.route === "separate-artwork") {
    return {
      ...configuration,
      designs: configuration.designs.map((design) => ({
        ...design,
        width: String(design.width),
        quantity: String(design.quantity),
      })),
    };
  }

  if (configuration.route === "transfers-by-size") {
    return {
      ...configuration,
      sizes: configuration.sizes.map((size) => ({
        ...size,
        width: String(size.width),
        quantity: String(size.quantity),
      })),
    };
  }

  return {
    ...configuration,
    garmentQuantity: String(configuration.garmentQuantity),
  };
}
