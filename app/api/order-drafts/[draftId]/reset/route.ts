import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { DraftConflictError, readDraftForOwner } from "@/lib/database/order-draft-repository";
import { isSameOriginRequest, readJsonBody, RequestBodyError } from "@/lib/http/security";
import { resetDraftRequestSchema, uuidSchema } from "@/lib/order-draft/durable";
import { cleanupArtworkForOwner } from "@/lib/server/artwork-service";
import {
  ArtworkCleanupIncompleteError,
  ArtworkConflictError,
  artworkSnapshotForOwner,
  finalizeDraftResetAfterArtworkCleanup,
} from "@/lib/database/artwork-repository";

export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const id = uuidSchema.safeParse((await context.params).draftId);
  if (!id.success) return apiError(400, "INVALID_REQUEST", "The draft identifier is invalid.");
  try {
    const input = resetDraftRequestSchema.parse(await readJsonBody(request));
    const current = await readDraftForOwner(id.data, owner.ownerUserId);
    if (!current) return apiError(404, "NOT_FOUND", "Draft not found.");
    if (current.version !== input.expectedVersion) throw new DraftConflictError("Draft version conflict.");
    const cleanup = await cleanupArtworkForOwner(id.data, owner.ownerUserId, input.expectedVersion);
    if (!cleanup) return apiError(404, "NOT_FOUND", "Draft not found.");
    if (!cleanup.complete) {
      return privateJson({
        error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "Artwork cleanup could not be completed. Retry Start Over." },
        draft: cleanup.draft,
        artwork: cleanup.artwork,
        readiness: cleanup.readiness,
      }, { status: 503 });
    }
    if (!cleanup.draft) return apiError(404, "NOT_FOUND", "Draft not found.");
    const draft = await finalizeDraftResetAfterArtworkCleanup({
      draftId: id.data,
      ownerUserId: owner.ownerUserId,
      expectedDraftVersion: cleanup.draft.version,
    });
    if (!draft) return apiError(404, "NOT_FOUND", "Draft not found.");
    return privateJson({ draft });
  } catch (error) {
    if (error instanceof ArtworkCleanupIncompleteError) {
      const latest = await readDraftForOwner(id.data, owner.ownerUserId).catch(() => null);
      const snapshot = latest ? await artworkSnapshotForOwner(id.data, owner.ownerUserId).catch(() => null) : null;
      if (latest && snapshot) return privateJson({
        error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "Artwork changed during cleanup. Retry Start Over." },
        draft: latest,
        ...snapshot,
      }, { status: 503 });
      return apiError(503, "ARTWORK_CLEANUP_INCOMPLETE", "Artwork cleanup could not be finalized.");
    }
    if (error instanceof DraftConflictError || error instanceof ArtworkConflictError) {
      const latest = await readDraftForOwner(id.data, owner.ownerUserId).catch(() => null);
      const snapshot = latest ? await artworkSnapshotForOwner(id.data, owner.ownerUserId).catch(() => null) : null;
      if (latest && snapshot) return privateJson({ error: { code: "VERSION_CONFLICT", message: "A newer version of this draft exists." }, draft: latest, ...snapshot }, { status: 409 });
      return apiError(409, "VERSION_CONFLICT", "A newer version of this draft exists.");
    }
    if (error instanceof RequestBodyError) return apiError(error.code === "BODY_TOO_LARGE" ? 413 : 400, error.code, "The request body is not valid.");
    if (error && typeof error === "object" && "issues" in error) return apiError(400, "INVALID_REQUEST", "The reset request is invalid.");
    return apiError(500, "SERVER_ERROR", "The draft could not be reset.");
  }
}
