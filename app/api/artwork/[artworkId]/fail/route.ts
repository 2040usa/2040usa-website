import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { artworkApiFailure } from "@/lib/api/artwork";
import { failArtworkRequestSchema } from "@/lib/artwork/schemas";
import { artworkSnapshotForOwner, markArtworkFailed } from "@/lib/database/artwork-repository";
import { isSameOriginRequest, readJsonBody } from "@/lib/http/security";
import { uuidSchema } from "@/lib/order-draft/durable";

export async function POST(request: Request, context: { params: Promise<{ artworkId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const artworkId = uuidSchema.safeParse((await context.params).artworkId);
  if (!artworkId.success) return apiError(400, "INVALID_REQUEST", "The artwork identifier is invalid.");
  try {
    const input = failArtworkRequestSchema.parse(await readJsonBody(request));
    const artwork = await markArtworkFailed({ id: artworkId.data, draftId: input.draftId, ownerUserId: owner.ownerUserId, expectedVersion: input.expectedVersion, failureCode: input.failureCode });
    if (!artwork) return apiError(404, "NOT_FOUND", "Artwork not found.");
    return privateJson(await artworkSnapshotForOwner(input.draftId, owner.ownerUserId));
  } catch (error) { return artworkApiFailure(error); }
}
