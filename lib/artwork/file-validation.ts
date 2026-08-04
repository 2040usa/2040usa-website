import { ARTWORK_MIME_BY_EXTENSION, MAX_ARTWORK_FILE_BYTES } from "@/lib/artwork/constants";
import { safeArtworkNameSchema } from "@/lib/artwork/schemas";
import type { ArtworkExtension } from "@/lib/artwork/types";

export type SelectedArtworkFile = {
  originalName: string;
  extension: ArtworkExtension;
  mimeType: typeof ARTWORK_MIME_BY_EXTENSION[ArtworkExtension];
  declaredSizeBytes: number;
  clientLastModified: number | null;
};

export function validateSelectedArtworkFile(file: Pick<File, "name" | "size" | "lastModified">): SelectedArtworkFile {
  const originalName = safeArtworkNameSchema.parse(file.name);
  const separator = originalName.lastIndexOf(".");
  const extension = separator > 0 ? originalName.slice(separator + 1).toLowerCase() : "";
  if (!(extension in ARTWORK_MIME_BY_EXTENSION)) throw new Error("Choose a PNG, JPG, JPEG, WebP, PDF, AI, or PSD file.");
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("The selected file is empty or has an invalid size.");
  if (file.size > MAX_ARTWORK_FILE_BYTES) throw new Error("Each artwork file must be 50 MiB or smaller.");
  return {
    originalName,
    extension: extension as ArtworkExtension,
    mimeType: ARTWORK_MIME_BY_EXTENSION[extension as ArtworkExtension],
    declaredSizeBytes: file.size,
    clientLastModified: Number.isSafeInteger(file.lastModified) && file.lastModified >= 0 ? file.lastModified : null,
  };
}

export function isPreviewableArtwork(extension: ArtworkExtension) {
  return extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp";
}
