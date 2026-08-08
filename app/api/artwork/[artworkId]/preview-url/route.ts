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
    // Records can disappear between a canonical snapshot render and route-change,
    // replacement, or deletion cleanup. A private empty result avoids turning that
    // expected race into a browser-level failed resource while disclosing no record
    // existence to a caller that does not own the artwork.
    if (!artwork || artwork.status !== "uploaded" || !["png", "jpg", "jpeg", "webp"].includes(artwork.extension)) return privateJson({ url: null, expiresIn: 0 });
    return privateJson({ url: await createArtworkPreviewUrl(artwork.storagePath, PREVIEW_URL_SECONDS), expiresIn: PREVIEW_URL_SECONDS });
  } catch (error) { return artworkApiFailure(error); }
}
