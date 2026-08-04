import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { artworkApiFailure } from "@/lib/api/artwork";
import { PREVIEW_URL_SECONDS } from "@/lib/artwork/constants";
import { artworkIdentityRequestSchema } from "@/lib/artwork/schemas";
import { readArtworkWithStorageIdentity } from "@/lib/database/artwork-repository";
import { isSameOriginRequest, readJsonBody } from "@/lib/http/security";
import { uuidSchema } from "@/lib/order-draft/durable";
import { createArtworkPreviewUrl } from "@/lib/server/artwork-service";

export async function POST(request: Request, context: { params: Promise<{ artworkId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const artworkId = uuidSchema.safeParse((await context.params).artworkId);
  if (!artworkId.success) return apiError(400, "INVALID_REQUEST", "The artwork identifier is invalid.");
  try {
    const { draftId } = artworkIdentityRequestSchema.parse(await readJsonBody(request));
    const artwork = await readArtworkWithStorageIdentity(artworkId.data, draftId, owner.ownerUserId);
    if (!artwork || artwork.status !== "uploaded" || !["png", "jpg", "jpeg", "webp"].includes(artwork.extension)) return apiError(404, "NOT_FOUND", "Preview not found.");
    return privateJson({ url: await createArtworkPreviewUrl(artwork.storagePath, PREVIEW_URL_SECONDS), expiresIn: PREVIEW_URL_SECONDS });
  } catch (error) { return artworkApiFailure(error); }
}
