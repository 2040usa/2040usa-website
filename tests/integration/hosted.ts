import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Pool } from "pg";
import { getHostedTestEnvironment } from "./hosted-test-environment";
import { acquireTurnstileToken } from "./turnstile-token";
import { createUnauthenticatedClient, runHostedRlsTests, type HostedOwner } from "./hosted-rls";

const environment = getHostedTestEnvironment();
const { runHostedDatabaseTests } = await import("./hosted-database");
const { runHostedArtworkTests } = await import("./hosted-artwork");
const { prisma } = await import("../../lib/database/prisma");
const pool = new Pool({ connectionString: environment.databaseUrl, max: 2 });
const testRunId = `increment-2a-${randomUUID()}`;

async function anonymousCount() {
  const result = await pool.query<{ count: number }>("select count(*)::integer as count from auth.users where is_anonymous is true");
  return result.rows[0].count;
}

async function createAnonymousOwner(label: "a" | "b"): Promise<HostedOwner> {
  const client = createClient(environment.url, environment.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const captchaToken = await acquireTurnstileToken(environment.turnstileSiteKey);
  const result = await client.auth.signInAnonymously({ options: { captchaToken, data: { test_run_id: testRunId, test_owner: label } } });
  if (result.error || !result.data.user || !result.data.session) throw new Error(`Anonymous test owner ${label} could not be created.`);
  return { client, userId: result.data.user.id };
}

const before = await anonymousCount();
const userA = await createAnonymousOwner("a");
const userB = await createAnonymousOwner("b");
const afterCreation = await anonymousCount();
assert.equal(afterCreation, before + 2, "The orchestrated run must create exactly two anonymous Auth users.");

try {
  const artworkOnly = process.argv.includes("--artwork-only");
  if (!artworkOnly) {
    await runHostedRlsTests({ userA, userB, unauthenticated: createUnauthenticatedClient(environment.url, environment.publishableKey) });
    await runHostedDatabaseTests({ pool, ownerA: userA.userId, ownerB: userB.userId });
  }
  await runHostedArtworkTests({ pool, userA, userB, unauthenticated: createUnauthenticatedClient(environment.url, environment.publishableKey) });
  const ownedRows = await pool.query<{ count: number }>("select count(*)::integer as count from public.order_drafts where owner_user_id = any($1::uuid[])", [[userA.userId, userB.userId]]);
  assert.equal(ownedRows.rows[0].count, 0, "The orchestrated run cleans only its own public draft rows.");
  const after = await anonymousCount();
  assert.equal(after, before + 2, "Auth users remain because admin deletion is not authorized.");
  console.log(`Hosted test run passed. Anonymous Auth users before: ${before}; after: ${after}; created: 2; remaining test Auth users: 2.`);
} finally {
  await pool.query("delete from public.order_drafts where owner_user_id = any($1::uuid[])", [[userA.userId, userB.userId]]);
  await prisma.$disconnect();
  await pool.end();
}
