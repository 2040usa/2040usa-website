import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { artworkApiFailure } from "@/lib/api/artwork";
import { artworkIdentityRequestSchema } from "@/lib/artwork/schemas";
import { artworkSnapshotForOwner, inspectArtworkObject, markArtworkFailed, markArtworkUploaded, readArtworkWithStorageIdentity, storageObjectMetadata } from "@/lib/database/artwork-repository";
import { isSameOriginRequest, readJsonBody } from "@/lib/http/security";
import { uuidSchema } from "@/lib/order-draft/durable";

export async function POST(request: Request, context: { params: Promise<{ artworkId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const artworkId = uuidSchema.safeParse((await context.params).artworkId);
  if (!artworkId.success) return apiError(400, "INVALID_REQUEST", "The artwork identifier is invalid.");
  try {
    const { draftId } = artworkIdentityRequestSchema.parse(await readJsonBody(request));
    const artwork = await readArtworkWithStorageIdentity(artworkId.data, draftId, owner.ownerUserId);
    if (!artwork) return apiError(404, "NOT_FOUND", "Artwork not found.");
    if (artwork.status === "uploaded") return privateJson(await artworkSnapshotForOwner(draftId, owner.ownerUserId));
    const object = await inspectArtworkObject(artwork.storagePath);
    if (!object || object.owner_id !== owner.ownerUserId) return apiError(409, "UPLOAD_VERIFICATION_FAILED", "The uploaded object could not be verified.");
    const metadata = storageObjectMetadata(object);
    const failureCode = metadata.size !== artwork.declaredSizeBytes ? "size_mismatch" : metadata.mimeType !== artwork.mimeType ? "mime_mismatch" : null;
    if (failureCode || !metadata.size || !metadata.mimeType) {
      await markArtworkFailed({ id: artwork.id, draftId, ownerUserId: owner.ownerUserId, expectedVersion: artwork.version, failureCode: failureCode ?? "verification_failed" });
      return apiError(409, "UPLOAD_VERIFICATION_FAILED", "The uploaded object metadata did not match the reservation.");
    }
    await markArtworkUploaded({ id: artwork.id, draftId, ownerUserId: owner.ownerUserId, expectedVersion: artwork.version, size: metadata.size, mimeType: metadata.mimeType });
    return privateJson(await artworkSnapshotForOwner(draftId, owner.ownerUserId));
  } catch (error) {
    return artworkApiFailure(error);
  }
}
