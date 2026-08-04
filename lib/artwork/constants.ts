import type { ArtworkExtension, ArtworkMimeType, ArtworkPurpose, OrderRouteArtworkPolicy } from "@/lib/artwork/types";
import type { OrderRoute } from "@/lib/order-draft/types";

export const ARTWORK_BUCKET = "customer-artwork";
export const MAX_ARTWORK_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_ARTWORK_DRAFT_BYTES = 250 * 1024 * 1024;
export const MAX_ARTWORK_FILES = 20;
export const MAX_SIMULTANEOUS_UPLOADS = 3;
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
export const UPLOAD_ATTEMPT_HOURS = 24;
export const PREVIEW_URL_SECONDS = 60;

export const ARTWORK_MIME_BY_EXTENSION = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
  ai: "application/postscript",
  psd: "image/vnd.adobe.photoshop",
} as const satisfies Record<ArtworkExtension, ArtworkMimeType>;

export const ARTWORK_ACCEPT = Object.entries(ARTWORK_MIME_BY_EXTENSION)
  .map(([extension, mime]) => `.${extension},${mime}`)
  .join(",");

export const ARTWORK_POLICY_BY_ROUTE: Record<OrderRoute, OrderRouteArtworkPolicy> = {
  "gang-sheet": { purpose: "gang-sheet-file", minimumUploaded: 1, maximumActive: MAX_ARTWORK_FILES },
  "separate-artwork": { purpose: "individual-design", minimumUploaded: 1, maximumActive: MAX_ARTWORK_FILES },
  "transfers-by-size": { purpose: "size-based-design", minimumUploaded: 1, maximumActive: 1 },
  "full-apparel": { purpose: "apparel-artwork-reference", minimumUploaded: 1, maximumActive: MAX_ARTWORK_FILES },
};

export const ARTWORK_PURPOSE_VALUES = [
  "gang-sheet-file",
  "individual-design",
  "size-based-design",
  "apparel-artwork-reference",
] as const satisfies readonly ArtworkPurpose[];

export const ARTWORK_FAILURE_CODES = [
  "upload_failed",
  "upload_expired",
  "object_missing",
  "size_mismatch",
  "mime_mismatch",
  "verification_failed",
  "deletion_failed",
] as const;

export const ARTWORK_TUS_ENDPOINT = "https://bcalocreiqbyufnakrnq.storage.supabase.co/storage/v1/upload/resumable";

export function purposeForRoute(route: OrderRoute) {
  return ARTWORK_POLICY_BY_ROUTE[route].purpose;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MiB`;
}
