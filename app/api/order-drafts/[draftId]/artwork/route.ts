import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { artworkApiFailure } from "@/lib/api/artwork";
import { ARTWORK_BUCKET } from "@/lib/artwork/constants";
import { reserveArtworkRequestSchema } from "@/lib/artwork/schemas";
import { artworkSnapshotForOwner, reserveArtworkForOwner } from "@/lib/database/artwork-repository";
import { readDraftForOwner } from "@/lib/database/order-draft-repository";
import { isSameOriginRequest, readJsonBody } from "@/lib/http/security";
import { uuidSchema } from "@/lib/order-draft/durable";

export async function GET(_: Request, context: { params: Promise<{ draftId: string }> }) {
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const draftId = uuidSchema.safeParse((await context.params).draftId);
  if (!draftId.success) return apiError(400, "INVALID_REQUEST", "The draft identifier is invalid.");
  try {
    if (!await readDraftForOwner(draftId.data, owner.ownerUserId)) {
      return apiError(404, "NOT_FOUND", "Draft not found.");
    }
    return privateJson(await artworkSnapshotForOwner(draftId.data, owner.ownerUserId));
  } catch {
    return apiError(500, "SERVER_ERROR", "Artwork could not be loaded.");
  }
}

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const draftId = uuidSchema.safeParse((await context.params).draftId);
  if (!draftId.success) return apiError(400, "INVALID_REQUEST", "The draft identifier is invalid.");
  try {
    const input = reserveArtworkRequestSchema.parse(await readJsonBody(request));
    const reserved = await reserveArtworkForOwner({ ...input, draftId: draftId.data, ownerUserId: owner.ownerUserId });
    if (!reserved) return apiError(404, "NOT_FOUND", "Draft not found.");
    return privateJson({
      artwork: reserved.record,
      upload: reserved.uploadRequired ? { artworkId: reserved.record.id, bucketName: ARTWORK_BUCKET, objectName: reserved.storagePath, contentType: reserved.record.mimeType, cacheControl: "3600" } : null,
    }, { status: 201 });
  } catch (error) {
    return artworkApiFailure(error);
  }
}
