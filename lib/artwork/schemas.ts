import { z } from "zod";
import { ARTWORK_FAILURE_CODES, ARTWORK_MIME_BY_EXTENSION, ARTWORK_PURPOSE_VALUES, MAX_ARTWORK_FILE_BYTES } from "@/lib/artwork/constants";
import { orderRouteSchema } from "@/lib/order-draft/schemas";

export const artworkExtensionSchema = z.enum(Object.keys(ARTWORK_MIME_BY_EXTENSION) as [keyof typeof ARTWORK_MIME_BY_EXTENSION, ...(keyof typeof ARTWORK_MIME_BY_EXTENSION)[]]);
export const artworkMimeTypeSchema = z.enum(Object.values(ARTWORK_MIME_BY_EXTENSION) as [typeof ARTWORK_MIME_BY_EXTENSION[keyof typeof ARTWORK_MIME_BY_EXTENSION], ...typeof ARTWORK_MIME_BY_EXTENSION[keyof typeof ARTWORK_MIME_BY_EXTENSION][]]);
export const artworkPurposeSchema = z.enum(ARTWORK_PURPOSE_VALUES);
export const artworkStatusSchema = z.enum(["pending", "uploaded", "failed", "deleting"]);
export const artworkFailureCodeSchema = z.enum(ARTWORK_FAILURE_CODES);
export const clientFingerprintSchema = z.string().regex(/^fp1:[0-9a-f]{64}$/, "The file recovery fingerprint is invalid.");
export const safeArtworkNameSchema = z.string()
  .trim()
  .min(1, "File name is required.")
  .max(255, "File name must be 255 characters or fewer.")
  .refine((value) => !/[\\/]/.test(value), "File name cannot contain path separators.")
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "File name cannot contain control characters.");

export const reserveArtworkRequestSchema = z.object({
  originalName: safeArtworkNameSchema,
  declaredSizeBytes: z.number().int().positive().max(MAX_ARTWORK_FILE_BYTES),
  extension: artworkExtensionSchema,
  mimeType: artworkMimeTypeSchema,
  clientLastModified: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  clientFingerprint: clientFingerprintSchema,
  purpose: artworkPurposeSchema,
  idempotencyKey: z.uuid(),
  recoverArtworkId: z.uuid().nullable().optional(),
  replacementForArtworkId: z.uuid().nullable().optional(),
}).strict().superRefine((value, context) => {
  if (ARTWORK_MIME_BY_EXTENSION[value.extension] !== value.mimeType) {
    context.addIssue({ code: "custom", path: ["mimeType"], message: "File extension and MIME type do not agree." });
  }
});
export type ReserveArtworkRequest = z.infer<typeof reserveArtworkRequestSchema>;

export const artworkIdentityRequestSchema = z.object({ draftId: z.uuid() }).strict();
export const artworkRecordVersionRequestSchema = artworkIdentityRequestSchema.extend({ expectedVersion: z.number().int().positive() }).strict();
export const artworkVersionRequestSchema = artworkRecordVersionRequestSchema.extend({ expectedDraftVersion: z.number().int().positive() }).strict();
export const failArtworkRequestSchema = artworkRecordVersionRequestSchema.extend({ failureCode: z.literal("upload_failed") }).strict();
export const acknowledgeArtworkRequestSchema = z.object({ expectedDraftVersion: z.number().int().positive() }).strict();
export const reconcileArtworkRequestSchema = z.object({ expectedDraftVersion: z.number().int().positive() }).strict();

export const canonicalArtworkRecordSchema = z.object({
  id: z.uuid(),
  draftId: z.uuid(),
  route: orderRouteSchema,
  purpose: artworkPurposeSchema,
  status: artworkStatusSchema,
  originalName: safeArtworkNameSchema,
  extension: artworkExtensionSchema,
  mimeType: artworkMimeTypeSchema,
  declaredSizeBytes: z.number().int().positive().max(MAX_ARTWORK_FILE_BYTES),
  clientLastModified: z.number().int().nonnegative().nullable(),
  clientFingerprint: clientFingerprintSchema,
  failureCode: artworkFailureCodeSchema.nullable(),
  attemptExpiresAt: z.iso.datetime(),
  uploadedAt: z.iso.datetime().nullable(),
  verifiedSizeBytes: z.number().int().positive().max(MAX_ARTWORK_FILE_BYTES).nullable(),
  verifiedMimeType: artworkMimeTypeSchema.nullable(),
  version: z.number().int().positive(),
  replacementForId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
