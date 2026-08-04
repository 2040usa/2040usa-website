import { canonicalArtworkRecordSchema } from "@/lib/artwork/schemas";
import type { CanonicalArtworkRecord } from "@/lib/artwork/types";

type DatabaseArtwork = {
  id: string;
  draftId: string;
  route: string;
  purpose: string;
  status: string;
  originalName: string;
  extension: string;
  mimeType: string;
  declaredSizeBytes: bigint;
  clientLastModified: bigint | null;
  clientFingerprint: string;
  failureCode: string | null;
  attemptExpiresAt: Date;
  uploadedAt: Date | null;
  verifiedSizeBytes: bigint | null;
  verifiedMimeType: string | null;
  version: number;
  replacementForId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function safeNumber(value: bigint | null) {
  if (value === null) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Artwork byte metadata exceeds safe client precision.");
  return number;
}

export function databaseArtworkToCanonical(record: DatabaseArtwork): CanonicalArtworkRecord {
  return canonicalArtworkRecordSchema.parse({
    id: record.id,
    draftId: record.draftId,
    route: record.route,
    purpose: record.purpose,
    status: record.status,
    originalName: record.originalName,
    extension: record.extension,
    mimeType: record.mimeType,
    declaredSizeBytes: safeNumber(record.declaredSizeBytes),
    clientLastModified: safeNumber(record.clientLastModified),
    clientFingerprint: record.clientFingerprint,
    failureCode: record.failureCode,
    attemptExpiresAt: record.attemptExpiresAt.toISOString(),
    uploadedAt: record.uploadedAt?.toISOString() ?? null,
    verifiedSizeBytes: safeNumber(record.verifiedSizeBytes),
    verifiedMimeType: record.verifiedMimeType,
    version: record.version,
    replacementForId: record.replacementForId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}
