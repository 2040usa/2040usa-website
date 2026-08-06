import type { OrderConfiguration, SizeVariant } from "@/lib/order-draft/types";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

export type SummaryItem = { label: string; value: string };
export type SummaryGroup = { title: string; items: SummaryItem[] };
const inches = (value: number) => `${value} in`;

export function describeSizeVariant(size: SizeVariant) {
  if (size.method === "width") return `Set by width: ${inches(size.width)} · quantity ${size.quantity}`;
  if (size.method === "height") return `Set by height: ${inches(size.height)} · quantity ${size.quantity}`;
  return `Use original artwork size · quantity ${size.quantity}`;
}

export function formatConfigurationSummary(configuration: OrderConfiguration, artwork: CanonicalArtworkRecord[] = []): SummaryGroup[] {
  if (configuration.route === "gang-sheet") {
    return [{ title: "Gang sheet details", items: [
      { label: "Number of sheets", value: String(configuration.sheetCount) },
      { label: "Finished width", value: inches(configuration.finishedWidth) },
      { label: "Finished length", value: inches(configuration.finishedLength) },
    ] }];
  }
  const names = new Map(artwork.map((record) => [record.id, record.originalName]));
  return configuration.designs.map((design) => ({
    title: names.get(design.artworkId) ?? "Uploaded design",
    items: [
      ...design.sizes.map((size, index) => ({ label: `Requested size ${index + 1}`, value: describeSizeVariant(size) })),
      { label: "Artwork changes", value: design.wantsChanges ? "Requested" : "No, print as uploaded" },
      ...(design.wantsChanges ? [{ label: "Change instructions", value: design.changeInstructions }] : []),
    ],
  }));
}

export function createDraftRowId() {
  return globalThis.crypto.randomUUID();
}
