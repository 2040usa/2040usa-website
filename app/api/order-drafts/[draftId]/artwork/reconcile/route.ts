import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { artworkApiFailure } from "@/lib/api/artwork";
import { reconcileArtworkRequestSchema } from "@/lib/artwork/schemas";
import { isSameOriginRequest, readJsonBody } from "@/lib/http/security";
import { uuidSchema } from "@/lib/order-draft/durable";
import { reconcileArtworkForOwner } from "@/lib/server/artwork-service";
import { ArtworkConflictError, artworkSnapshotForOwner } from "@/lib/database/artwork-repository";
import { readDraftForOwner } from "@/lib/database/order-draft-repository";

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const draftId = uuidSchema.safeParse((await context.params).draftId);
  if (!draftId.success) return apiError(400, "INVALID_REQUEST", "The draft identifier is invalid.");
  try {
    const input = reconcileArtworkRequestSchema.parse(await readJsonBody(request));
    const result = await reconcileArtworkForOwner(draftId.data, owner.ownerUserId, input.expectedDraftVersion);
    if (!result.draft) return apiError(404, "NOT_FOUND", "Draft not found.");
    return privateJson(result);
  } catch (error) {
    if (error instanceof ArtworkConflictError) {
      const snapshot = await artworkSnapshotForOwner(draftId.data, owner.ownerUserId);
      return privateJson({ error: { code: "VERSION_CONFLICT", message: "A newer draft version exists." }, ...snapshot, draft: await readDraftForOwner(draftId.data, owner.ownerUserId) }, { status: 409 });
    }
    return artworkApiFailure(error);
  }
}
