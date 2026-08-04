import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type HostedOwner = { client: SupabaseClient; userId: string };

export async function runHostedRlsTests(input: { userA: HostedOwner; userB: HostedOwner; unauthenticated: SupabaseClient }) {
  const { userA, userB, unauthenticated } = input;
  try {
    const insertA = await userA.client.from("order_drafts").insert({ owner_user_id: userA.userId }).select().single();
    assert.equal(insertA.error, null, "Owner A should insert its own draft.");
    const insertB = await userB.client.from("order_drafts").insert({ owner_user_id: userB.userId }).select().single();
    assert.equal(insertB.error, null, "Owner B should insert its own draft.");
    assert.ok(insertA.data?.id && insertB.data?.id);

    const ownerRead = await userA.client.from("order_drafts").select("id,version").eq("id", insertA.data.id).single();
    assert.equal(ownerRead.error, null, "Owner should read its draft.");
    const ownerUpdate = await userA.client.from("order_drafts").update({ selected_route: "gang-sheet", starting_point_confirmed: true, artwork_acknowledged: true }).eq("id", insertA.data.id).select("version").single();
    assert.equal(ownerUpdate.error, null, "Owner should update its draft.");

    const malformedWorking = [{}, { route: null }, { route: 7 }, { route: "separate-artwork" }];
    for (const value of malformedWorking) {
      const result = await userA.client.from("order_drafts").update({ working_configuration: value }).eq("id", insertA.data.id).select("id");
      assert.ok(result.error, `Authenticated Data API must reject malformed working route ${JSON.stringify(value)}.`);
    }
    const malformedCompleted = [{}, { route: null }, { route: 7 }, { route: "separate-artwork" }];
    for (const value of malformedCompleted) {
      const result = await userA.client.from("order_drafts").update({ configuration: value }).eq("id", insertA.data.id).select("id");
      assert.ok(result.error, `Authenticated Data API must reject malformed completed route ${JSON.stringify(value)}.`);
    }

    const crossRead = await userA.client.from("order_drafts").select("id").eq("id", insertB.data.id);
    assert.equal(crossRead.error, null);
    assert.deepEqual(crossRead.data, [], "User A must not see User B's draft.");
    const crossUpdate = await userA.client.from("order_drafts").update({ selected_route: "gang-sheet", starting_point_confirmed: true }).eq("id", insertB.data.id).select("id");
    assert.equal(crossUpdate.error, null);
    assert.deepEqual(crossUpdate.data, [], "User A must not update User B's draft.");

    const foreignInsert = await userA.client.from("order_drafts").insert({ owner_user_id: userB.userId });
    assert.ok(foreignInsert.error, "User A must not insert a draft owned by User B.");
    const ownershipChange = await userA.client.from("order_drafts").update({ owner_user_id: userB.userId }).eq("id", insertA.data.id);
    assert.ok(ownershipChange.error, "Ownership cannot be changed.");
    const duplicate = await userA.client.from("order_drafts").insert({ owner_user_id: userA.userId });
    assert.ok(duplicate.error, "Only one active draft per owner is allowed.");

    const anonymousRead = await unauthenticated.from("order_drafts").select("id");
    assert.ok(anonymousRead.error || anonymousRead.data?.length === 0, "Unauthenticated reads must be denied.");
    const anonymousWrite = await unauthenticated.from("order_drafts").insert({ owner_user_id: userA.userId });
    assert.ok(anonymousWrite.error, "Unauthenticated writes must be denied.");
  } finally {
    await userA.client.from("order_drafts").delete().eq("owner_user_id", userA.userId);
    await userB.client.from("order_drafts").delete().eq("owner_user_id", userB.userId);
  }
}

export function createUnauthenticatedClient(url: string, publishableKey: string) {
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
