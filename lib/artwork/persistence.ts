"use client";

import { z } from "zod";
import { artworkMimeTypeSchema, canonicalArtworkRecordSchema } from "@/lib/artwork/schemas";
import { canonicalOrderDraftSchema } from "@/lib/order-draft/durable";

const readinessSchema = z.object({
  ready: z.boolean(), uploadedCount: z.number().int().nonnegative(), activeCount: z.number().int().nonnegative(),
  totalDeclaredBytes: z.number().int().nonnegative(), totalVerifiedBytes: z.number().int().nonnegative(),
}).strict();

const snapshotSchema = z.object({ artwork: z.array(canonicalArtworkRecordSchema), readiness: readinessSchema }).passthrough();
const snapshotWithDraftSchema = snapshotSchema.extend({ draft: canonicalOrderDraftSchema.nullable() });
const reservationSchema = z.object({
  artwork: canonicalArtworkRecordSchema,
  upload: z.object({ artworkId: z.uuid(), bucketName: z.literal("customer-artwork"), objectName: z.string().min(1), contentType: artworkMimeTypeSchema, cacheControl: z.literal("3600") }).strict().nullable(),
}).strict();

export class ArtworkRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly snapshot?: z.infer<typeof snapshotWithDraftSchema>,
  ) { super(message); }
}

export async function artworkResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try { body = await response.json(); } catch { throw new ArtworkRequestError("The artwork service returned malformed JSON.", response.status); }
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? (body as { error?: { code?: string; message?: string } }).error : undefined;
    const snapshot = snapshotWithDraftSchema.safeParse(body);
    throw new ArtworkRequestError(error?.message ?? "The artwork request failed.", response.status, error?.code, snapshot.success ? snapshot.data : undefined);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ArtworkRequestError("The artwork service returned an invalid response.", response.status);
  return parsed.data;
}

export const parseArtworkSnapshot = (response: Response) => artworkResponse(response, snapshotSchema);
export const parseArtworkSnapshotWithDraft = (response: Response) => artworkResponse(response, snapshotWithDraftSchema);
export const parseArtworkReservation = (response: Response) => artworkResponse(response, reservationSchema);
export { snapshotSchema as artworkSnapshotSchema };
