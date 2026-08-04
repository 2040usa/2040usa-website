import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { bootstrapActiveDraft, DraftConflictError } from "@/lib/database/order-draft-repository";
import { isSameOriginRequest, readJsonBody, RequestBodyError } from "@/lib/http/security";
import { bootstrapDraftRequestSchema } from "@/lib/order-draft/durable";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  try {
    const input = bootstrapDraftRequestSchema.parse(await readJsonBody(request));
    const draft = await bootstrapActiveDraft(owner.ownerUserId, input.selectedRoute, input.expectedVersion);
    return privateJson({ draft });
  } catch (error) {
    if (error instanceof DraftConflictError) return apiError(409, "VERSION_CONFLICT", "A newer version of this draft exists.");
    if (error instanceof RequestBodyError) return apiError(error.code === "BODY_TOO_LARGE" ? 413 : 400, error.code, "The request body is not valid.");
    if (error && typeof error === "object" && "issues" in error) return apiError(400, "INVALID_REQUEST", "The draft request is invalid.");
    return apiError(500, "SERVER_ERROR", "The draft could not be established.");
  }
}
