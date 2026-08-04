import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HostedOwner } from "./hosted-rls";
import { ARTWORK_BUCKET, MAX_ARTWORK_FILE_BYTES } from "../../lib/artwork/constants";
import {
  ArtworkCleanupIncompleteError,
  ArtworkConflictError,
  ArtworkIdempotencyConflictError,
  ArtworkQuotaError,
  ArtworkRecoveryError,
  acknowledgeReadyArtwork,
  artworkSnapshotForOwner,
  deleteArtworkRowForOwner,
  finalizeDraftResetAfterArtworkCleanup,
  finalizeRouteChangeAfterArtworkCleanup,
  markArtworkFailed,
  prepareDraftArtworkCleanup,
  reserveArtworkForOwner,
  prepareArtworkDeletion,
} from "../../lib/database/artwork-repository";
import { bootstrapActiveDraft, readDraftForOwner, updateDraftForOwner } from "../../lib/database/order-draft-repository";
import { cleanupArtworkForOwner, reconcileArtworkForOwner } from "../../lib/server/artwork-service";

const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const fingerprint = (suffix: string) => `fp1:${createHash("sha256").update(suffix).digest("hex")}`;

function reservation(ownerUserId: string, draftId: string, suffix: string) {
  return {
    draftId,
    ownerUserId,
    originalName: "repository.png",
    declaredSizeBytes: pngBytes.byteLength,
    extension: "png" as const,
    mimeType: "image/png" as const,
    clientLastModified: 1,
    clientFingerprint: fingerprint(suffix),
    purpose: "gang-sheet-file" as const,
    idempotencyKey: randomUUID(),
    recoverArtworkId: null,
    replacementForArtworkId: null,
  };
}

async function removeIfPresent(client: SupabaseClient, path: string) {
  await client.storage.from(ARTWORK_BUCKET).remove([path]);
}

export async function runHostedArtworkTests(input: { pool: Pool; userA: HostedOwner; userB: HostedOwner; unauthenticated: SupabaseClient }) {
  const { pool, userA, userB, unauthenticated } = input;
  const paths = new Set<string>();
  await pool.query("delete from public.order_drafts where owner_user_id = any($1::uuid[])", [[userA.userId, userB.userId]]);

  try {
    const bucket = await pool.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>("select public, file_size_limit, allowed_mime_types from storage.buckets where id = $1", [ARTWORK_BUCKET]);
    assert.equal(bucket.rows[0]?.public, false);
    assert.equal(Number(bucket.rows[0]?.file_size_limit), MAX_ARTWORK_FILE_BYTES);
    assert.deepEqual(new Set(bucket.rows[0]?.allowed_mime_types), new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "application/postscript", "image/vnd.adobe.photoshop"]));

    const draftA = await bootstrapActiveDraft(userA.userId, "gang-sheet");
    const draftB = await bootstrapActiveDraft(userB.userId, "gang-sheet");
    const requestA = reservation(userA.userId, draftA.id, "authority-a");
    const requestB = reservation(userB.userId, draftB.id, "authority-b");
    const reservedA = await reserveArtworkForOwner(requestA);
    const reservedB = await reserveArtworkForOwner(requestB);
    assert.ok(reservedA && reservedB);
    paths.add(reservedA.storagePath); paths.add(reservedB.storagePath);

    assert.equal((await userA.client.from("artwork_files").select("id").eq("id", reservedA.record.id)).data?.length, 1, "Owner retains read-only row visibility.");
    assert.deepEqual((await userA.client.from("artwork_files").select("id").eq("id", reservedB.record.id)).data, [], "Cross-owner rows remain undisclosed.");
    assert.ok((await userA.client.from("artwork_files").insert({ id: randomUUID() })).error, "Authenticated Data API insert must be denied.");
    assert.ok((await userA.client.from("artwork_files").update({ status: "failed" }).eq("id", reservedA.record.id)).error, "Authenticated Data API update must be denied.");
    assert.ok((await userA.client.from("artwork_files").delete().eq("id", reservedA.record.id)).error, "Authenticated Data API delete must be denied.");
    assert.ok((await unauthenticated.from("artwork_files").select("id")).error || (await unauthenticated.from("artwork_files").select("id")).data?.length === 0);
    assert.ok((await unauthenticated.from("artwork_files").insert({ id: randomUUID() })).error);

    const uploadA = await userA.client.storage.from(ARTWORK_BUCKET).upload(reservedA.storagePath, pngBytes, { contentType: "image/png", upsert: false });
    const uploadB = await userB.client.storage.from(ARTWORK_BUCKET).upload(reservedB.storagePath, pngBytes, { contentType: "image/png", upsert: false });
    assert.equal(uploadA.error, null); assert.equal(uploadB.error, null);
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).upload(`users/${userA.userId}/unreserved.png`, pngBytes, { contentType: "image/png" })).error, "Unreserved path must be denied.");
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).upload(reservedB.storagePath, pngBytes, { contentType: "image/png" })).error, "Foreign reserved path must be denied.");
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).upload(reservedA.storagePath, pngBytes, { contentType: "image/png", upsert: true })).error, "Overwrite must be denied.");
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).download(reservedA.storagePath)).error, null);
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).download(reservedB.storagePath)).error);

    await assert.rejects(() => pool.query(
      `insert into public.artwork_files (
        id, draft_id, owner_user_id, route, purpose, original_name, extension, mime_type,
        declared_size_bytes, client_fingerprint, idempotency_key, storage_path, attempt_expires_at
      ) values ($1,$2,$3,'gang-sheet','gang-sheet-file','bad.png','png','image/png',8,$4,$5,'arbitrary/path.png',now()+interval '1 hour')`,
      [randomUUID(), draftA.id, userA.userId, fingerprint("bad-path"), randomUUID()],
    ), "The database must reject noncanonical Storage paths even for direct writes.");
    await assert.rejects(() => pool.query("update public.artwork_files set original_name = 'changed.png' where id = $1", [reservedA.record.id]), "Reservation identity must be immutable.");
    await assert.rejects(() => pool.query("update public.artwork_files set replacement_for_id = $2 where id = $1", [reservedA.record.id, reservedB.record.id]), "Replacement identity cannot be attached after insertion.");

    const reconciledA = await reconcileArtworkForOwner(draftA.id, userA.userId, draftA.version);
    assert.equal(reconciledA.artwork[0]?.status, "uploaded", "Server lifecycle updates remain authorized.");
    const acknowledged = await acknowledgeReadyArtwork({ draftId: draftA.id, ownerUserId: userA.userId, expectedVersion: reconciledA.draft!.version });
    assert.equal(acknowledged?.draft.artworkAcknowledged, true);
    const advanced = await updateDraftForOwner({
      id: draftA.id,
      ownerUserId: userA.userId,
      expectedVersion: acknowledged!.draft.version,
      selectedRoute: "gang-sheet",
      startingPointConfirmed: true,
      artworkAcknowledged: true,
      workingConfiguration: { route: "gang-sheet", sheetCount: "2", finishedWidth: "22", finishedLength: "36", notes: "newer" },
      configuration: { route: "gang-sheet", sheetCount: 2, finishedWidth: 22, finishedLength: 36, notes: "newer" },
    });
    assert.ok(advanced);
    await assert.rejects(
      () => reconcileArtworkForOwner(draftA.id, userA.userId, acknowledged!.draft.version),
      ArtworkConflictError,
      "Stale reconciliation cannot adopt a newer draft version.",
    );
    await assert.rejects(
      () => acknowledgeReadyArtwork({ draftId: draftA.id, ownerUserId: userA.userId, expectedVersion: acknowledged!.draft.version }),
      ArtworkConflictError,
      "Stale acknowledgment cannot acknowledge a newer draft.",
    );
    const afterStale = await readDraftForOwner(draftA.id, userA.userId);
    assert.deepEqual(afterStale?.configuration, advanced!.configuration, "Stale artwork operations preserve the newer validated state.");

    await removeIfPresent(userA.client, reservedA.storagePath); paths.delete(reservedA.storagePath);
    await removeIfPresent(userB.client, reservedB.storagePath); paths.delete(reservedB.storagePath);
    await pool.query("delete from public.order_drafts where owner_user_id = any($1::uuid[])", [[userA.userId, userB.userId]]);

    const recoveryDraft = await bootstrapActiveDraft(userA.userId, "gang-sheet");
    const identicalA = reservation(userA.userId, recoveryDraft.id, "identical");
    const identicalB = { ...identicalA, idempotencyKey: randomUUID() };
    const first = await reserveArtworkForOwner(identicalA);
    const second = await reserveArtworkForOwner(identicalB);
    assert.ok(first && second);
    assert.notEqual(first.record.id, second.record.id, "Identical metadata with distinct requests must create distinct records.");
    assert.notEqual(first.storagePath, second.storagePath);
    assert.equal((await reserveArtworkForOwner(identicalA))?.record.id, first.record.id, "Exact idempotent retry must reuse one reservation.");
    await assert.rejects(() => reserveArtworkForOwner({ ...identicalA, originalName: "different.png" }), ArtworkIdempotencyConflictError);

    const third = await reserveArtworkForOwner({ ...identicalA, idempotencyKey: randomUUID() });
    assert.notEqual(third?.record.id, first.record.id, "A new selection never recovers by fingerprint alone.");
    const recovered = await reserveArtworkForOwner({ ...identicalA, idempotencyKey: randomUUID(), recoverArtworkId: first.record.id });
    assert.equal(recovered?.record.id, first.record.id, "Explicit unexpired recovery reuses the exact record.");
    assert.equal(recovered?.storagePath, first.storagePath);
    assert.equal(
      await reserveArtworkForOwner({ ...identicalA, ownerUserId: userB.userId, idempotencyKey: randomUUID(), recoverArtworkId: first.record.id }),
      null,
      "Cross-owner recovery remains generic not found.",
    );

    await pool.query("update public.artwork_files set status='failed', failure_code='upload_expired', attempt_expires_at=now()-interval '1 minute' where id=$1", [second.record.id]);
    const expiredRestart = await reserveArtworkForOwner({ ...identicalB, idempotencyKey: randomUUID(), recoverArtworkId: second.record.id });
    assert.ok(expiredRestart);
    assert.notEqual(expiredRestart.record.id, second.record.id, "Expired recovery starts with a new ID.");
    assert.notEqual(expiredRestart.storagePath, second.storagePath, "Expired recovery never overwrites the old path.");
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).upload(second.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, "A retired expired path remains unauthorized.");
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).upload(expiredRestart.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, null, "Explicit expired recovery authorizes its new path.");
    paths.add(expiredRestart.storagePath);

    const retryable = await reserveArtworkForOwner({ ...identicalA, clientFingerprint: fingerprint("retryable-failed"), idempotencyKey: randomUUID() });
    assert.ok(retryable);
    await markArtworkFailed({ id: retryable.record.id, draftId: recoveryDraft.id, ownerUserId: userA.userId, expectedVersion: retryable.record.version, failureCode: "upload_failed" });
    const retryableRecovery = await reserveArtworkForOwner({
      ...identicalA,
      clientFingerprint: fingerprint("retryable-failed"),
      idempotencyKey: randomUUID(),
      recoverArtworkId: retryable.record.id,
    });
    assert.equal(retryableRecovery?.record.id, retryable.record.id, "Unexpired upload_failed recovery reuses the exact artwork ID.");
    assert.equal(retryableRecovery?.storagePath, retryable.storagePath, "Unexpired upload_failed recovery reuses the exact path.");
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).upload(retryableRecovery!.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, null, "Unexpired upload_failed retry remains authorized.");
    paths.add(retryable.storagePath);

    for (const failureCode of ["size_mismatch", "mime_mismatch", "verification_failed"] as const) {
      const invalidRequest = { ...identicalA, clientFingerprint: fingerprint(`invalid-recovery-${failureCode}`), idempotencyKey: randomUUID() };
      const invalid = await reserveArtworkForOwner(invalidRequest);
      assert.ok(invalid);
      await pool.query("update public.artwork_files set status='failed', failure_code=$2 where id=$1", [invalid.record.id, failureCode]);
      await assert.rejects(
        () => reserveArtworkForOwner({ ...invalidRequest, idempotencyKey: randomUUID(), recoverArtworkId: invalid.record.id }),
        ArtworkRecoveryError,
        `${failureCode} must not be reset to pending or reuse its path.`,
      );
      const unchanged = await pool.query<{ status: string; failure_code: string }>("select status, failure_code from public.artwork_files where id=$1", [invalid.record.id]);
      assert.deepEqual(unchanged.rows[0], { status: "failed", failure_code: failureCode });
      await assert.rejects(() => reserveArtworkForOwner(invalidRequest), ArtworkRecoveryError, "Lifecycle-aware idempotency cannot return unsafe old-path upload metadata.");
    }

    const missingRequest = { ...identicalA, clientFingerprint: fingerprint("missing-restart"), idempotencyKey: randomUUID() };
    const missing = await reserveArtworkForOwner(missingRequest);
    assert.ok(missing);
    await pool.query("update public.artwork_files set status='failed', failure_code='object_missing' where id=$1", [missing.record.id]);
    const missingRestart = await reserveArtworkForOwner({ ...missingRequest, idempotencyKey: randomUUID(), recoverArtworkId: missing.record.id });
    assert.ok(missingRestart);
    assert.notEqual(missingRestart.record.id, missing.record.id, "object_missing recovery creates a new artwork ID.");
    assert.notEqual(missingRestart.storagePath, missing.storagePath, "object_missing recovery creates a new path.");

    const occupiedRequest = { ...identicalA, clientFingerprint: fingerprint("occupied-invalid"), idempotencyKey: randomUUID() };
    const occupied = await reserveArtworkForOwner(occupiedRequest);
    assert.ok(occupied);
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).upload(occupied.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, null);
    paths.add(occupied.storagePath);
    await pool.query("update public.artwork_files set status='failed', failure_code='size_mismatch' where id=$1", [occupied.record.id]);
    await assert.rejects(
      () => reserveArtworkForOwner({ ...occupiedRequest, idempotencyKey: randomUUID(), recoverArtworkId: occupied.record.id }),
      ArtworkRecoveryError,
      "An invalid object occupying its canonical path cannot be overwritten or resumed.",
    );
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).upload(occupied.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error);
    await removeIfPresent(userA.client, occupied.storagePath); paths.delete(occupied.storagePath);
    await pool.query("update public.artwork_files set status='deleting', failure_code=null where id=$1", [occupied.record.id]);
    assert.equal(await deleteArtworkRowForOwner(occupied.record.id, recoveryDraft.id, userA.userId), true);
    const afterInvalidRemoval = await reserveArtworkForOwner({ ...occupiedRequest, idempotencyKey: randomUUID() });
    assert.ok(afterInvalidRemoval);
    assert.notEqual(afterInvalidRemoval.storagePath, occupied.storagePath, "Selection after invalid-object removal receives a new path.");

    for (const failureCode of ["upload_expired", "object_missing", "size_mismatch", "mime_mismatch", "verification_failed", "deletion_failed"] as const) {
      const denied = await reserveArtworkForOwner({ ...identicalA, clientFingerprint: fingerprint(`denied-${failureCode}`), idempotencyKey: randomUUID() });
      assert.ok(denied);
      await pool.query(
        "update public.artwork_files set status='failed', failure_code=$2, attempt_expires_at=now()+interval '1 hour' where id=$1",
        [denied.record.id, failureCode],
      );
      assert.ok(
        (await userA.client.storage.from(ARTWORK_BUCKET).upload(denied.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error,
        `${failureCode} must not authorize Storage INSERT.`,
      );
    }

    const expiringPending = await reserveArtworkForOwner({ ...identicalA, clientFingerprint: fingerprint("expired-pending-policy"), idempotencyKey: randomUUID() });
    assert.ok(expiringPending);
    await pool.query("update public.artwork_files set attempt_expires_at=clock_timestamp()+interval '250 milliseconds' where id=$1", [expiringPending.record.id]);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok((await userA.client.storage.from(ARTWORK_BUCKET).upload(expiringPending.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, "Expired pending rows must not authorize Storage INSERT.");

    const completedExpired = third!;
    paths.add(completedExpired.storagePath);
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).upload(completedExpired.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, null);
    await pool.query("update public.artwork_files set status='failed', failure_code='upload_expired', attempt_expires_at=now()-interval '1 minute' where id=$1", [completedExpired.record.id]);
    const recoveredObject = await reserveArtworkForOwner({ ...identicalA, idempotencyKey: randomUUID(), recoverArtworkId: completedExpired.record.id });
    assert.equal(recoveredObject?.record.id, completedExpired.record.id);
    assert.equal(recoveredObject?.record.status, "uploaded");
    assert.equal(recoveredObject?.uploadRequired, false, "A completed object is reconciled rather than overwritten.");

    const configured = await updateDraftForOwner({
      id: recoveryDraft.id,
      ownerUserId: userA.userId,
      expectedVersion: recoveryDraft.version,
      selectedRoute: "gang-sheet",
      startingPointConfirmed: true,
      artworkAcknowledged: true,
      workingConfiguration: null,
      configuration: { route: "gang-sheet", sheetCount: 1, finishedWidth: 1, finishedLength: 1, notes: "cleanup" },
    });
    assert.ok(configured);
    const cleanupCalls: string[] = [];
    const partial = await cleanupArtworkForOwner(recoveryDraft.id, userA.userId, configured!.version, async (path) => {
      cleanupCalls.push(path);
      if (cleanupCalls.length === 2) throw new Error("forced deletion failure");
      await removeIfPresent(userA.client, path); paths.delete(path);
    });
    assert.equal(partial?.complete, false);
    assert.equal(partial?.draft?.selectedRoute, "gang-sheet");
    assert.equal(partial?.draft?.artworkAcknowledged, false);
    assert.equal(partial?.draft?.configuration, null);
    assert.ok(partial?.artwork.some((record) => record.status === "deleting"), "Failed cleanup remains retryable and visible.");
    const retryPaths: string[] = [];
    const retried = await cleanupArtworkForOwner(recoveryDraft.id, userA.userId, partial!.draft!.version, async (path) => {
      retryPaths.push(path);
      await removeIfPresent(userA.client, path); paths.delete(path);
    });
    assert.equal(retried?.complete, true);
    assert.equal(retried?.artwork.length, 0);
    assert.ok(!retryPaths.includes(cleanupCalls[0]!), "An already deleted row is not repeated on retry.");

    await pool.query("delete from public.order_drafts where owner_user_id = $1", [userA.userId]);
    const rowFailureDraft = await bootstrapActiveDraft(userA.userId, "gang-sheet");
    const rowFailureReservation = await reserveArtworkForOwner(reservation(userA.userId, rowFailureDraft.id, "row-delete-failure"));
    assert.ok(rowFailureReservation);
    const rowFailureCleanup = await cleanupArtworkForOwner(
      rowFailureDraft.id,
      userA.userId,
      rowFailureDraft.version,
      async () => undefined,
      async () => false,
    );
    assert.equal(rowFailureCleanup?.complete, false, "Cleanup cannot complete while a prepared row still exists.");
    assert.equal(rowFailureCleanup?.artwork.length, 1);
    const rowFailureRetry = await cleanupArtworkForOwner(rowFailureDraft.id, userA.userId, rowFailureCleanup!.draft!.version, async () => undefined);
    assert.equal(rowFailureRetry?.complete, true, "An absent object plus successful row retry completes cleanup.");

    await pool.query("delete from public.order_drafts where owner_user_id = $1", [userA.userId]);
    const idempotentDeleteDraft = await bootstrapActiveDraft(userA.userId, "gang-sheet");
    const idempotentDeleteReservation = await reserveArtworkForOwner(reservation(userA.userId, idempotentDeleteDraft.id, "idempotent-row-delete"));
    assert.ok(idempotentDeleteReservation);
    const idempotentDeleteCleanup = await cleanupArtworkForOwner(
      idempotentDeleteDraft.id,
      userA.userId,
      idempotentDeleteDraft.version,
      async () => undefined,
      async (id, draftId, ownerUserId) => {
        await deleteArtworkRowForOwner(id, draftId, ownerUserId);
        return false;
      },
    );
    assert.equal(idempotentDeleteCleanup?.complete, true, "A zero delete result is safe only after owner-scoped lookup proves the row is absent.");

    await pool.query("delete from public.order_drafts where owner_user_id = $1", [userA.userId]);
    const concurrentDraft = await bootstrapActiveDraft(userA.userId, "gang-sheet");
    const preparedConcurrent = await prepareDraftArtworkCleanup({
      draftId: concurrentDraft.id,
      ownerUserId: userA.userId,
      expectedDraftVersion: concurrentDraft.version,
    });
    assert.ok(preparedConcurrent);
    const lateReservation = await reserveArtworkForOwner(reservation(userA.userId, concurrentDraft.id, "late-reservation"));
    assert.ok(lateReservation);
    await assert.rejects(
      () => finalizeRouteChangeAfterArtworkCleanup({
        draftId: concurrentDraft.id,
        ownerUserId: userA.userId,
        expectedDraftVersion: preparedConcurrent!.draft.version,
        selectedRoute: "separate-artwork",
      }),
      ArtworkCleanupIncompleteError,
      "A reservation inserted after preparation prevents route finalization.",
    );
    assert.equal((await readDraftForOwner(concurrentDraft.id, userA.userId))?.selectedRoute, "gang-sheet");
    const lateCleanup = await cleanupArtworkForOwner(concurrentDraft.id, userA.userId, preparedConcurrent!.draft.version, async () => undefined);
    assert.equal(lateCleanup?.complete, true);
    const finalizedRoute = await finalizeRouteChangeAfterArtworkCleanup({
      draftId: concurrentDraft.id,
      ownerUserId: userA.userId,
      expectedDraftVersion: lateCleanup!.draft!.version,
      selectedRoute: "separate-artwork",
    });
    assert.equal(finalizedRoute?.selectedRoute, "separate-artwork");

    const resetReservation = await reserveArtworkForOwner({
      ...reservation(userA.userId, concurrentDraft.id, "late-reset-reservation"),
      purpose: "individual-design",
    });
    assert.ok(resetReservation);
    const resetPreparation = await prepareDraftArtworkCleanup({
      draftId: concurrentDraft.id,
      ownerUserId: userA.userId,
      expectedDraftVersion: finalizedRoute!.version,
    });
    assert.ok(resetPreparation);
    const resetCleanup = await cleanupArtworkForOwner(concurrentDraft.id, userA.userId, resetPreparation!.draft.version, async () => undefined);
    assert.equal(resetCleanup?.complete, true);
    const finalizedReset = await finalizeDraftResetAfterArtworkCleanup({
      draftId: concurrentDraft.id,
      ownerUserId: userA.userId,
      expectedDraftVersion: resetCleanup!.draft!.version,
    });
    assert.equal(finalizedReset?.selectedRoute, null);

    await pool.query("delete from public.order_drafts where owner_user_id = $1", [userA.userId]);
    const transferDraft = await bootstrapActiveDraft(userA.userId, "transfers-by-size");
    const transferRequest = { ...reservation(userA.userId, transferDraft.id, "transfer"), purpose: "size-based-design" as const };
    const transferFirst = await reserveArtworkForOwner(transferRequest);
    assert.ok(transferFirst);
    await assert.rejects(
      () => reserveArtworkForOwner({ ...transferRequest, clientFingerprint: fingerprint("transfer-2"), idempotencyKey: randomUUID() }),
      ArtworkQuotaError,
      "Transfers by Size must reject a second active reservation without an explicit replacement target.",
    );
    paths.add(transferFirst.storagePath);
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).upload(transferFirst.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, null);
    await reconcileArtworkForOwner(transferDraft.id, userA.userId, transferDraft.version);
    const replacement = await reserveArtworkForOwner({
      ...transferRequest,
      clientFingerprint: fingerprint("transfer-replacement"),
      idempotencyKey: randomUUID(),
      replacementForArtworkId: transferFirst.record.id,
    });
    assert.ok(replacement);
    assert.notEqual(replacement.storagePath, transferFirst.storagePath);
    paths.add(replacement.storagePath);
    assert.equal((await userA.client.storage.from(ARTWORK_BUCKET).upload(replacement.storagePath, pngBytes, { contentType: "image/png", upsert: false })).error, null);
    await reconcileArtworkForOwner(transferDraft.id, userA.userId, transferDraft.version);
    const beforeReplacementDelete = await artworkSnapshotForOwner(transferDraft.id, userA.userId);
    const old = beforeReplacementDelete.artwork.find((record) => record.id === transferFirst.record.id)!;
    const preparedReplacementDelete = await prepareArtworkDeletion({
      id: old.id,
      draftId: transferDraft.id,
      ownerUserId: userA.userId,
      expectedArtworkVersion: old.version,
      expectedDraftVersion: transferDraft.version,
    });
    assert.ok(preparedReplacementDelete);
    const failedReplacementSnapshot = await artworkSnapshotForOwner(transferDraft.id, userA.userId);
    assert.equal(failedReplacementSnapshot.readiness.ready, true, "The verified replacement remains canonical while old-object deletion is retryable.");
    assert.equal(failedReplacementSnapshot.artwork.find((record) => record.id === old.id)?.status, "deleting");
    assert.equal(failedReplacementSnapshot.artwork.find((record) => record.id === replacement.record.id)?.status, "uploaded");
    await removeIfPresent(userA.client, transferFirst.storagePath); paths.delete(transferFirst.storagePath);
    assert.equal(await deleteArtworkRowForOwner(old.id, transferDraft.id, userA.userId), true);
    const finishedReplacement = await artworkSnapshotForOwner(transferDraft.id, userA.userId);
    assert.deepEqual(finishedReplacement.artwork.map((record) => record.id), [replacement.record.id]);
    assert.equal(finishedReplacement.readiness.ready, true);
  } finally {
    for (const path of paths) await removeIfPresent(userA.client, path).catch(() => undefined);
    await pool.query("delete from public.order_drafts where owner_user_id = any($1::uuid[])", [[userA.userId, userB.userId]]);
  }
}
