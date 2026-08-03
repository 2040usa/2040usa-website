import type { OrderConfiguration } from "@/lib/order-draft/types";

export type SummaryItem = { label: string; value: string };
export type SummaryGroup = { title: string; items: SummaryItem[] };

const summaryLabels: Record<string, string> = {
  "customer-supplies": "Customer supplies garments",
  "2040-supplies": "2040 USA supplies garments",
  "not-sure": "Not sure yet",
  "t-shirts": "T-shirts",
  "hoodies-sweatshirts": "Hoodies or sweatshirts",
  caps: "Caps",
  "mixed-apparel": "Mixed apparel",
  "other-not-sure": "Other or not sure",
  front: "Front",
  back: "Back",
  "left-sleeve": "Left sleeve",
  "right-sleeve": "Right sleeve",
};

const inches = (value: number) => `${value} in`;
const readableLabel = (value: string) => summaryLabels[value] ?? value;

export function formatConfigurationSummary(configuration: OrderConfiguration): SummaryGroup[] {
  if (configuration.route === "gang-sheet") {
    return [{
      title: "Gang sheet details",
      items: [
        { label: "Number of sheets", value: String(configuration.sheetCount) },
        { label: "Finished width", value: inches(configuration.finishedWidth) },
        { label: "Finished length", value: inches(configuration.finishedLength) },
      ],
    }];
  }

  if (configuration.route === "separate-artwork") {
    return [{
      title: `${configuration.designs.length} design${configuration.designs.length === 1 ? "" : "s"}`,
      items: configuration.designs.map((design, index) => ({
        label: `${index + 1}. ${design.label}`,
        value: `${inches(design.width)} x ${design.quantity}`,
      })),
    }];
  }

  if (configuration.route === "transfers-by-size") {
    return [
      { title: "Design", items: [{ label: "Internal label", value: configuration.designLabel }] },
      {
        title: `${configuration.sizes.length} size${configuration.sizes.length === 1 ? "" : "s"}`,
        items: configuration.sizes.map((size, index) => ({ label: `Size ${index + 1}`, value: `${inches(size.width)} x ${size.quantity}` })),
      },
    ];
  }

  return [{
    title: "Apparel project details",
    items: [
      { label: "Garment source", value: readableLabel(configuration.garmentSource) },
      { label: "Project type", value: readableLabel(configuration.projectType) },
      { label: "Estimated quantity", value: String(configuration.garmentQuantity) },
      { label: "Print locations", value: configuration.printLocations.map(readableLabel).join(", ") },
    ],
  }];
}

export function createDraftRowId() {
  return globalThis.crypto.randomUUID();
}
