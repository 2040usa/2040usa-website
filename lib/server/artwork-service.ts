import "server-only";
import { readDraftForOwner } from "@/lib/database/order-draft-repository";
import {
  artworkSnapshotForOwner,
  inspectArtworkObject,
  markArtworkFailed,
  markArtworkUploaded,
  readArtworkWithStorageIdentity,
  storageObjectMetadata,
  deleteArtworkRowForOwner,
  countArtworkRowsForOwner,
  prepareDraftArtworkCleanup,
  revokeArtworkProgressForOwner,
  ArtworkConflictError,
  type PreparedArtworkCleanupRecord,
  synchronizeUploadedArtworkConfigurationForOwner,
  rebindReplacementConfigurationForOwner,
} from "@/lib/database/artwork-repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function reconcileArtworkForOwner(draftId: string, ownerUserId: string, expectedDraftVersion: number) {
  const submittedVersion = expectedDraftVersion;
  const submittedDraft = await readDraftForOwner(draftId, ownerUserId);
  if (!submittedDraft) return { ...(await artworkSnapshotForOwner(draftId, ownerUserId)), draft: null };
  if (submittedDraft.version !== submittedVersion) {
    throw new ArtworkConflictError();
  }
  let snapshot = await artworkSnapshotForOwner(draftId, ownerUserId);
  let readinessRevoked = false;

  for (const record of snapshot.artwork) {
    const internal = await readArtworkWithStorageIdentity(record.id, draftId, ownerUserId);
    if (!internal || internal.status === "deleting") continue;
    const object = await inspectArtworkObject(internal.storagePath);

    if ((record.status === "pending" || record.status === "failed") && object?.owner_id === ownerUserId) {
      const metadata = storageObjectMetadata(object);
      const failureCode = metadata.size !== record.declaredSizeBytes ? "size_mismatch" : metadata.mimeType !== record.mimeType ? "mime_mismatch" : null;
      if (!failureCode && metadata.size && metadata.mimeType) {
        await markArtworkUploaded({ id: record.id, draftId, ownerUserId, expectedVersion: record.version, size: metadata.size, mimeType: metadata.mimeType });
        await rebindReplacementConfigurationForOwner({ artworkId: record.id, draftId, ownerUserId });
        await synchronizeUploadedArtworkConfigurationForOwner({ artworkId: record.id, draftId, ownerUserId });
      } else {
        await markArtworkFailed({ id: record.id, draftId, ownerUserId, expectedVersion: record.version, failureCode: failureCode ?? "verification_failed" });
      }
      continue;
    }
    if (record.status === "pending" && !object && new Date(record.attemptExpiresAt).getTime() <= Date.now()) {
      await markArtworkFailed({ id: record.id, draftId, ownerUserId, expectedVersion: record.version, failureCode: "upload_expired" });
    }
    if (record.status === "uploaded" && !object) {
      await markArtworkFailed({ id: record.id, draftId, ownerUserId, expectedVersion: record.version, failureCode: "object_missing", allowUploaded: true });
      readinessRevoked = true;
    }
    if (record.status === "uploaded" && object?.owner_id === ownerUserId) {
      await rebindReplacementConfigurationForOwner({ artworkId: record.id, draftId, ownerUserId });
      await synchronizeUploadedArtworkConfigurationForOwner({ artworkId: record.id, draftId, ownerUserId });
    }
  }

  snapshot = await artworkSnapshotForOwner(draftId, ownerUserId);
  const draftBefore = await readDraftForOwner(draftId, ownerUserId);
  if (!draftBefore) return { ...snapshot, draft: null };
  const shouldRevoke = (draftBefore.artworkAcknowledged || draftBefore.configuration !== null)
    && (!snapshot.readiness.ready || readinessRevoked);
  const draft = shouldRevoke
    ? await revokeArtworkProgressForOwner({ draftId, ownerUserId, expectedDraftVersion: submittedVersion })
    : draftBefore;
  return { ...(await artworkSnapshotForOwner(draftId, ownerUserId)), draft };
}

async function cleanPreparedRecords(
  draftId: string,
  ownerUserId: string,
  records: PreparedArtworkCleanupRecord[],
  removeObject: (storagePath: string) => Promise<void>,
  deleteRow: (id: string, draftId: string, ownerUserId: string) => Promise<boolean>,
) {
  for (const record of records) {
    try {
      await removeObject(record.storagePath);
    } catch {
      return false;
    }
    const deleted = await deleteRow(record.id, draftId, ownerUserId);
    if (!deleted && await readArtworkWithStorageIdentity(record.id, draftId, ownerUserId)) return false;
  }
  return await countArtworkRowsForOwner(draftId, ownerUserId) === 0;
}

export async function cleanupArtworkForOwner(
  draftId: string,
  ownerUserId: string,
  expectedDraftVersion: number,
  removeObject: (storagePath: string) => Promise<void> = deleteArtworkObject,
  deleteRow: (id: string, draftId: string, ownerUserId: string) => Promise<boolean> = deleteArtworkRowForOwner,
) {
  const prepared = await prepareDraftArtworkCleanup({ draftId, ownerUserId, expectedDraftVersion });
  if (!prepared) return null;
  const complete = await cleanPreparedRecords(draftId, ownerUserId, prepared.cleanup, removeObject, deleteRow);
  return {
    complete,
    draft: await readDraftForOwner(draftId, ownerUserId),
    ...(await artworkSnapshotForOwner(draftId, ownerUserId)),
  };
}

export async function deleteArtworkObject(storagePath: string) {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.storage.from("customer-artwork").remove([storagePath]);
  if (result.error && !/not found/i.test(result.error.message)) throw new Error("STORAGE_DELETE_FAILED");
}

export async function createArtworkPreviewUrl(storagePath: string, expiresIn: number) {
  const supabase = await createSupabaseServerClient();
  const result = await supabase.storage.from("customer-artwork").createSignedUrl(storagePath, expiresIn);
  if (result.error || !result.data?.signedUrl) throw new Error("STORAGE_PREVIEW_FAILED");
  return result.data.signedUrl;
}
