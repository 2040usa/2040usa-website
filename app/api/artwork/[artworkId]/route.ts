import { apiError, getVerifiedOwner, ownerErrorResponse, privateJson } from "@/lib/api/order-drafts";
import { artworkApiFailure } from "@/lib/api/artwork";
import { artworkVersionRequestSchema } from "@/lib/artwork/schemas";
import { ArtworkConflictError, artworkSnapshotForOwner, deleteArtworkRowForOwner, prepareArtworkDeletion } from "@/lib/database/artwork-repository";
import { readDraftForOwner } from "@/lib/database/order-draft-repository";
import { isSameOriginRequest, readJsonBody } from "@/lib/http/security";
import { uuidSchema } from "@/lib/order-draft/durable";
import { deleteArtworkObject } from "@/lib/server/artwork-service";

export async function DELETE(request: Request, context: { params: Promise<{ artworkId: string }> }) {
  if (!isSameOriginRequest(request)) return apiError(403, "ORIGIN_MISMATCH", "The request origin is not allowed.");
  const owner = await getVerifiedOwner();
  if (owner.kind !== "verified") return ownerErrorResponse(owner);
  const artworkId = uuidSchema.safeParse((await context.params).artworkId);
  if (!artworkId.success) return apiError(400, "INVALID_REQUEST", "The artwork identifier is invalid.");
  let draftIdForError: string | null = null;
  try {
    const input = artworkVersionRequestSchema.parse(await readJsonBody(request));
    draftIdForError = input.draftId;
    const prepared = await prepareArtworkDeletion({
      id: artworkId.data,
      draftId: input.draftId,
      ownerUserId: owner.ownerUserId,
      expectedArtworkVersion: input.expectedVersion,
      expectedDraftVersion: input.expectedDraftVersion,
    });
    if (!prepared) return apiError(404, "NOT_FOUND", "Artwork not found.");
    try { await deleteArtworkObject(prepared.cleanup.storagePath); } catch {
      const snapshot = await artworkSnapshotForOwner(input.draftId, owner.ownerUserId);
      return privateJson({
        error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "The artwork object could not be removed. Retry deletion." },
        ...snapshot,
        draft: await readDraftForOwner(input.draftId, owner.ownerUserId),
      }, { status: 503 });
    }
    const rowDeleted = await deleteArtworkRowForOwner(artworkId.data, input.draftId, owner.ownerUserId);
    if (!rowDeleted) {
      const stillPresent = (await artworkSnapshotForOwner(input.draftId, owner.ownerUserId)).artwork
        .some((record) => record.id === artworkId.data);
      if (stillPresent) {
        const snapshot = await artworkSnapshotForOwner(input.draftId, owner.ownerUserId);
        return privateJson({
          error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "The artwork record could not be removed. Retry deletion." },
          ...snapshot,
          draft: await readDraftForOwner(input.draftId, owner.ownerUserId),
        }, { status: 503 });
      }
    }
    const snapshot = await artworkSnapshotForOwner(input.draftId, owner.ownerUserId);
    const draft = await readDraftForOwner(input.draftId, owner.ownerUserId);
    return privateJson({ ...snapshot, draft });
  } catch (error) {
    if (error instanceof ArtworkConflictError && draftIdForError) {
      const snapshot = await artworkSnapshotForOwner(draftIdForError, owner.ownerUserId).catch(() => null);
      const draft = await readDraftForOwner(draftIdForError, owner.ownerUserId).catch(() => null);
      if (snapshot) return privateJson({ error: { code: "VERSION_CONFLICT", message: "A newer artwork or draft version exists." }, ...snapshot, draft }, { status: 409 });
    }
    return artworkApiFailure(error);
  }
}
