import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { bootstrapActiveDraft, DraftConflictError, findActiveDraftForOwner } from "@/lib/database/order-draft-repository";
import { isSameOriginRequest, readJsonBody, RequestBodyError } from "@/lib/http/security";
import { bootstrapDraftRequestSchema } from "@/lib/order-draft/durable";
import { cleanupArtworkForOwner } from "@/lib/server/artwork-service";
import {
  ArtworkCleanupIncompleteError,
  ArtworkConflictError,
  artworkSnapshotForOwner,
  finalizeRouteChangeAfterArtworkCleanup,
} from "@/lib/database/artwork-repository";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  try {
    const input = bootstrapDraftRequestSchema.parse(await readJsonBody(request));
    const existing = await findActiveDraftForOwner(owner.ownerUserId);
    if (existing && existing.selectedRoute && existing.selectedRoute !== input.selectedRoute) {
      if (input.expectedVersion !== existing.version) throw new DraftConflictError("Draft version conflict.");
      const cleanup = await cleanupArtworkForOwner(existing.id, owner.ownerUserId, existing.version);
      if (!cleanup) return apiError(404, "NOT_FOUND", "Draft not found.");
      if (!cleanup.complete) {
        return privateJson({
          error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "Existing artwork could not be removed. Retry the route change." },
          draft: cleanup.draft,
          artwork: cleanup.artwork,
          readiness: cleanup.readiness,
        }, { status: 503 });
      }
      if (!cleanup.draft) return apiError(404, "NOT_FOUND", "Draft not found.");
      const draft = await finalizeRouteChangeAfterArtworkCleanup({
        draftId: existing.id,
        ownerUserId: owner.ownerUserId,
        expectedDraftVersion: cleanup.draft.version,
        selectedRoute: input.selectedRoute,
      });
      if (!draft) return apiError(404, "NOT_FOUND", "Draft not found.");
      return privateJson({ draft });
    }
    const draft = await bootstrapActiveDraft(owner.ownerUserId, input.selectedRoute, input.expectedVersion);
    return privateJson({ draft });
  } catch (error) {
    if (error instanceof ArtworkCleanupIncompleteError) {
      const latest = await findActiveDraftForOwner(owner.ownerUserId).catch(() => null);
      const snapshot = latest ? await artworkSnapshotForOwner(latest.id, owner.ownerUserId).catch(() => null) : null;
      if (latest && snapshot) return privateJson({
        error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "Artwork changed during cleanup. Retry the route change." },
        draft: latest,
        ...snapshot,
      }, { status: 503 });
      return apiError(503, "ARTWORK_CLEANUP_INCOMPLETE", "Artwork cleanup could not be finalized.");
    }
    if (error instanceof DraftConflictError || error instanceof ArtworkConflictError) {
      const latest = await findActiveDraftForOwner(owner.ownerUserId).catch(() => null);
      if (latest) {
        const snapshot = await artworkSnapshotForOwner(latest.id, owner.ownerUserId).catch(() => null);
        if (snapshot) return privateJson({ error: { code: "VERSION_CONFLICT", message: "A newer version of this draft exists." }, draft: latest, ...snapshot }, { status: 409 });
      }
      return apiError(409, "VERSION_CONFLICT", "A newer version of this draft exists.");
    }
    if (error instanceof RequestBodyError) return apiError(error.code === "BODY_TOO_LARGE" ? 413 : 400, error.code, "The request body is not valid.");
    if (error && typeof error === "object" && "issues" in error) return apiError(400, "INVALID_REQUEST", "The draft request is invalid.");
    return apiError(500, "SERVER_ERROR", "The draft could not be established.");
  }
}
