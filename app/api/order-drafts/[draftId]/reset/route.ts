import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { DraftConflictError, resetDraftForOwner } from "@/lib/database/order-draft-repository";
import { isSameOriginRequest, readJsonBody, RequestBodyError } from "@/lib/http/security";
import { resetDraftRequestSchema, uuidSchema } from "@/lib/order-draft/durable";

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const id = uuidSchema.safeParse((await context.params).draftId);
  if (!id.success) return apiError(400, "INVALID_REQUEST", "The draft identifier is invalid.");
  try {
    const input = resetDraftRequestSchema.parse(await readJsonBody(request));
    const draft = await resetDraftForOwner(id.data, owner.ownerUserId, input.expectedVersion);
    if (!draft) return apiError(404, "NOT_FOUND", "Draft not found.");
    return privateJson({ draft });
  } catch (error) {
    if (error instanceof DraftConflictError) return apiError(409, "VERSION_CONFLICT", "A newer version of this draft exists.");
    if (error instanceof RequestBodyError) return apiError(error.code === "BODY_TOO_LARGE" ? 413 : 400, error.code, "The request body is not valid.");
    if (error && typeof error === "object" && "issues" in error) return apiError(400, "INVALID_REQUEST", "The reset request is invalid.");
    return apiError(500, "SERVER_ERROR", "The draft could not be reset.");
  }
}
