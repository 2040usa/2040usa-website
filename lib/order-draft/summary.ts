import type { OrderConfiguration, SizeVariant } from "@/lib/order-draft/types";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

export type SummaryItem = { label: string; value: string };
export type SummaryGroup = { artworkId: string; title: string; items: SummaryItem[] };
const inches = (value: number) => `${value} in`;

export function describeSizeVariant(size: SizeVariant) {
  if (size.method === "width") return `Set by width: ${inches(size.width)} · quantity ${size.quantity}`;
  if (size.method === "height") return `Set by height: ${inches(size.height)} · quantity ${size.quantity}`;
  return `Use original artwork size · quantity ${size.quantity}`;
}

export function formatConfigurationSummary(configuration: OrderConfiguration, artwork: CanonicalArtworkRecord[] = []): SummaryGroup[] {
  if (configuration.route === "gang-sheet") {
    const names = new Map(artwork.map((record) => [record.id, record.originalName]));
    return configuration.sheets.map((sheet) => ({ artworkId: sheet.artworkId, title: names.get(sheet.artworkId) ?? "Uploaded gang sheet", items: [
      { label: "Finished size", value: `${inches(sheet.finishedWidth)} × ${inches(sheet.finishedLength)}` },
      { label: "Copies", value: String(sheet.copies) },
    ] }));
  }
  const names = new Map(artwork.map((record) => [record.id, record.originalName]));
  return configuration.designs.map((design) => ({
    artworkId: design.artworkId,
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
