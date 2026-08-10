import type { CanonicalArtworkRecord } from "@/lib/artwork/types";
import type { WorkingIndividualDesignsConfiguration } from "@/lib/order-draft/types";
import type { LayoutVariantInput } from "@/lib/gang-sheet-layout/types";

export type IntrinsicArtworkGeometry = { widthPixels: number; heightPixels: number };

export function resolveLayoutVariants(
  configuration: Pick<WorkingIndividualDesignsConfiguration, "designs">,
  artwork: CanonicalArtworkRecord[],
  geometry: ReadonlyMap<string, IntrinsicArtworkGeometry>,
): LayoutVariantInput[] {
  const records = new Map(artwork.map((record) => [record.id, record]));
  return configuration.designs.flatMap((design) => design.sizes.map((size, index) => {
    const record = records.get(design.artworkId);
    const base = {
      artworkId: design.artworkId,
      artworkName: record?.originalName ?? "Uploaded design",
      variantId: size.id,
      variantLabel: `Requested size ${index + 1}`,
      quantity: Number(size.quantity),
    };
    if (!size.method || !Number.isFinite(Number(size.quantity)) || !Number.isInteger(Number(size.quantity)) || Number(size.quantity) < 1) {
      return { ...base, widthInches: null, heightInches: null, unresolvedReason: "Complete the sizing method and quantity." };
    }
    if (size.method === "original") {
      return { ...base, widthInches: null, heightInches: null, unresolvedReason: "Original Size has no verified physical dimensions. Pixel dimensions are not converted to inches." };
    }
    const requested = Number(size.dimension);
    if (!Number.isFinite(requested) || requested <= 0) {
      return { ...base, widthInches: null, heightInches: null, unresolvedReason: "Enter a positive requested dimension." };
    }
    const intrinsic = geometry.get(design.artworkId);
    if (!intrinsic || intrinsic.widthPixels <= 0 || intrinsic.heightPixels <= 0) {
      const format = record?.extension?.toUpperCase() ?? "Artwork";
      return { ...base, widthInches: null, heightInches: null, unresolvedReason: `${format} aspect ratio is unavailable from the private preview.` };
    }
    const ratio = intrinsic.widthPixels / intrinsic.heightPixels;
    return size.method === "width"
      ? { ...base, widthInches: requested, heightInches: requested / ratio }
      : { ...base, widthInches: requested * ratio, heightInches: requested };
  }));
}
