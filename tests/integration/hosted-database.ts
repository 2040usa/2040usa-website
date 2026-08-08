import assert from "node:assert/strict";
import type { Pool } from "pg";
import { bootstrapActiveDraft, findActiveDraftForOwner, readDraftForOwner, resetDraftForOwner, updateDraftForOwner, DraftConflictError } from "../../lib/database/order-draft-repository";
import { draftSnapshotRequestSchema } from "../../lib/order-draft/durable";

export async function runHostedDatabaseTests(input: { pool: Pool; ownerA: string; ownerB: string }) {
  const { pool, ownerA, ownerB } = input;
  await pool.query("delete from public.order_drafts where owner_user_id = any($1::uuid[])", [[ownerA, ownerB]]);
  try {
    const [first, concurrent] = await Promise.all([
      bootstrapActiveDraft(ownerA, "gang-sheet"),
      bootstrapActiveDraft(ownerA, "gang-sheet"),
    ]);
    assert.equal(first.id, concurrent.id, "Concurrent bootstrap must return the same active draft.");
    const secondOwner = await bootstrapActiveDraft(ownerB, "individual-designs");
    assert.notEqual(first.id, secondOwner.id, "Different owners receive different drafts.");
    assert.equal((await findActiveDraftForOwner(ownerA))?.id, first.id);
    assert.equal(await readDraftForOwner(first.id, ownerB), null, "Cross-owner lookup must be not found.");

    const firstWrite = await updateDraftForOwner({
      id: first.id,
      ownerUserId: ownerA,
      expectedVersion: first.version,
      selectedRoute: "gang-sheet",
      startingPointConfirmed: true,
      artworkAcknowledged: true,
      workingConfiguration: { route: "gang-sheet", sheets: [], notes: "first atomic response" },
      configuration: null,
    });
    assert.equal(firstWrite?.version, first.version + 1, "A successful update increments version exactly once.");
    const secondWrite = await updateDraftForOwner({
      id: first.id,
      ownerUserId: ownerA,
      expectedVersion: firstWrite!.version,
      selectedRoute: "gang-sheet",
      startingPointConfirmed: true,
      artworkAcknowledged: true,
      workingConfiguration: { route: "gang-sheet", sheets: [], notes: "later writer" },
      configuration: null,
    });
    assert.equal(firstWrite?.version, first.version + 1);
    assert.equal(firstWrite?.workingConfiguration?.notes, "first atomic response", "The first write returns its own row, not a later writer's snapshot.");
    assert.equal(secondWrite?.version, first.version + 2);

    await assert.rejects(() => updateDraftForOwner({
      id: first.id,
      ownerUserId: ownerA,
      expectedVersion: first.version,
      selectedRoute: "gang-sheet",
      startingPointConfirmed: true,
      artworkAcknowledged: true,
      workingConfiguration: null,
      configuration: null,
    }), DraftConflictError, "A stale version must conflict.");

    const beforeTimestamp = secondWrite!.updatedAt;
    await pool.query("select pg_sleep(0.01)");
    const reset = await resetDraftForOwner(first.id, ownerA, secondWrite!.version);
    assert.equal(reset?.version, secondWrite!.version + 1);
    assert.equal(reset?.selectedRoute, null);
    assert.ok(reset!.updatedAt > beforeTimestamp, "updated_at must advance on updates.");
    const routed = await bootstrapActiveDraft(ownerA, "gang-sheet", reset!.version);
    assert.equal(routed.version, reset!.version + 1);
    const idempotent = await bootstrapActiveDraft(ownerA, "gang-sheet", reset!.version);
    assert.equal(idempotent.version, routed.version, "Reconfirming the canonical route is idempotent even after a retry with an old version.");
    await assert.rejects(() => bootstrapActiveDraft(ownerA, "individual-designs", reset!.version), DraftConflictError, "A stale route change must conflict.");

    const constraintCases = [
      ["route constraint", "update public.order_drafts set selected_route = 'checkout' where id = $1"],
      ["version constraint", "update public.order_drafts set version = 0 where id = $1"],
      ["lifecycle constraint", "update public.order_drafts set selected_route = null, starting_point_confirmed = true where id = $1"],
      ["working missing route", "update public.order_drafts set working_configuration = '{}'::jsonb where id = $1"],
      ["working null route", "update public.order_drafts set working_configuration = '{\"route\":null}'::jsonb where id = $1"],
      ["working numeric route", "update public.order_drafts set working_configuration = '{\"route\":7}'::jsonb where id = $1"],
      ["working mismatched route", "update public.order_drafts set working_configuration = '{\"route\":\"individual-designs\"}'::jsonb where id = $1"],
      ["completed missing route", "update public.order_drafts set artwork_acknowledged = true, configuration = '{}'::jsonb where id = $1"],
      ["completed null route", "update public.order_drafts set artwork_acknowledged = true, configuration = '{\"route\":null}'::jsonb where id = $1"],
      ["completed numeric route", "update public.order_drafts set artwork_acknowledged = true, configuration = '{\"route\":7}'::jsonb where id = $1"],
      ["completed mismatched route", "update public.order_drafts set artwork_acknowledged = true, configuration = '{\"route\":\"individual-designs\"}'::jsonb where id = $1"],
    ] as const;
    for (const [label, sql] of constraintCases) {
      await pool.query("begin");
      try { await assert.rejects(() => pool.query(sql, [routed.id]), label); }
      finally { await pool.query("rollback"); }
    }

    const invalidCompleted = draftSnapshotRequestSchema.safeParse({ expectedVersion: routed.version, selectedRoute: "gang-sheet", startingPointConfirmed: true, artworkAcknowledged: true, workingConfiguration: null, configuration: { route: "gang-sheet", sheets: [], notes: "" } });
    assert.equal(invalidCompleted.success, false, "Invalid completed configuration is rejected before repository persistence.");
  } finally {
    await pool.query("delete from public.order_drafts where owner_user_id = any($1::uuid[])", [[ownerA, ownerB]]);
  }
}
