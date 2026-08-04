import { describe, expect, it } from "vitest";
import { validatePublicEnvironment, validateServerEnvironment, DEVELOPMENT_PROJECT_REF, TURNSTILE_ALWAYS_PASS_SITE_KEY } from "../lib/env/validation";
import { bootstrapDraftRequestSchema, databaseDraftToCanonical, deriveCompletedStep, DraftResponseError, draftSnapshotRequestSchema, parseCurrentDraftResponse, uuidSchema } from "../lib/order-draft/durable";
import { persistenceResponseKind } from "../lib/order-draft/persistence";
import { isSameOriginRequest, readJsonBody } from "../lib/http/security";
import { createOrderDraftStore } from "../lib/order-draft/store";
import { inspectBrowserSession } from "../lib/supabase/session-inspection";
import { verifyOwnerWithClient } from "../lib/supabase/owner-verification";

const publicEnvironment = {
  NEXT_PUBLIC_APP_DEPLOYMENT_ENV: "development" as const,
  NEXT_PUBLIC_SUPABASE_URL: `https://${DEVELOPMENT_PROJECT_REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_ALWAYS_PASS_SITE_KEY,
};
const serverEnvironment = {
  ...publicEnvironment,
  APP_DEPLOYMENT_ENV: "development" as const,
  DATABASE_URL: `postgresql://postgres.${DEVELOPMENT_PROJECT_REF}:password@db.${DEVELOPMENT_PROJECT_REF}.supabase.co:5432/postgres`,
  SUPABASE_EXPECTED_PROJECT_REF: DEVELOPMENT_PROJECT_REF,
};

describe("durable environment boundaries", () => {
  it("fails closed for missing, unknown, or contradictory deployment modes", () => {
    expect(() => validatePublicEnvironment({ ...publicEnvironment, NEXT_PUBLIC_APP_DEPLOYMENT_ENV: undefined })).toThrow();
    expect(() => validatePublicEnvironment({ ...publicEnvironment, NEXT_PUBLIC_APP_DEPLOYMENT_ENV: "staging" })).toThrow();
    expect(() => validateServerEnvironment({ ...serverEnvironment, APP_DEPLOYMENT_ENV: "test" })).toThrow(/must match/);
  });

  it("accepts only the dedicated project in explicit development mode", () => {
    expect(validateServerEnvironment(serverEnvironment).SUPABASE_EXPECTED_PROJECT_REF).toBe(DEVELOPMENT_PROJECT_REF);
    expect(() => validateServerEnvironment({ ...serverEnvironment, SUPABASE_EXPECTED_PROJECT_REF: "another-project" })).toThrow(/authorized/);
  });

  it("rejects the development project and Turnstile test key in production", () => {
    expect(() => validatePublicEnvironment({ ...publicEnvironment, NEXT_PUBLIC_APP_DEPLOYMENT_ENV: "production" })).toThrow(/development Supabase project/);
    const productionProject = { ...publicEnvironment, NEXT_PUBLIC_APP_DEPLOYMENT_ENV: "production" as const, NEXT_PUBLIC_SUPABASE_URL: "https://production-ref.supabase.co" };
    expect(() => validatePublicEnvironment(productionProject)).toThrow(/Turnstile test credentials/);
  });

  it("allows a trusted production host to force production protections", () => {
    expect(() => validateServerEnvironment(serverEnvironment, "production")).toThrow(/development Supabase project/);
  });
});

describe("draft request and lifecycle validation", () => {
  const base = { expectedVersion: 1, selectedRoute: "gang-sheet" as const, startingPointConfirmed: true, artworkAcknowledged: false, workingConfiguration: null, configuration: null };

  it("validates UUIDs, route consistency, and incomplete working state", () => {
    expect(uuidSchema.safeParse("71e9305b-56f3-4df3-85c0-bbf8ca6e2c25").success).toBe(true);
    expect(uuidSchema.safeParse("not-an-owner").success).toBe(false);
    expect(draftSnapshotRequestSchema.safeParse({ ...base, workingConfiguration: { route: "gang-sheet", sheetCount: "", finishedWidth: "22", finishedLength: "36", notes: "editing" } }).success).toBe(true);
    expect(draftSnapshotRequestSchema.safeParse({ ...base, workingConfiguration: { route: "separate-artwork", designs: [], notes: "" } }).success).toBe(false);
    expect(bootstrapDraftRequestSchema.safeParse({ selectedRoute: "gang-sheet" }).success).toBe(true);
    expect(bootstrapDraftRequestSchema.safeParse({ selectedRoute: "gang-sheet", expectedVersion: 3 }).success).toBe(true);
  });

  it("rejects invalid lifecycle combinations and accepts completed configuration", () => {
    expect(draftSnapshotRequestSchema.safeParse({ ...base, selectedRoute: null, startingPointConfirmed: true }).success).toBe(false);
    expect(draftSnapshotRequestSchema.safeParse({ ...base, artworkAcknowledged: true, startingPointConfirmed: false }).success).toBe(false);
    const configuration = { route: "gang-sheet" as const, sheetCount: 1, finishedWidth: 22, finishedLength: 36, notes: "" };
    expect(draftSnapshotRequestSchema.safeParse({ ...base, artworkAcknowledged: true, configuration }).success).toBe(true);
    expect(deriveCompletedStep({ ...base, artworkAcknowledged: true, configuration })).toBe(3);
    expect(deriveCompletedStep({ ...base, artworkAcknowledged: true, configuration: null })).toBe(2);
  });

  it("maps canonical database records and conflict responses", () => {
    const canonical = databaseDraftToCanonical({ id: "71e9305b-56f3-4df3-85c0-bbf8ca6e2c25", status: "active", selectedRoute: "gang-sheet", startingPointConfirmed: true, artworkAcknowledged: false, workingConfiguration: null, configuration: null, version: 4, updatedAt: new Date("2026-08-03T12:00:00Z") });
    expect(canonical).toMatchObject({ version: 4, lastCompletedStep: 1, selectedRoute: "gang-sheet" });
    expect(persistenceResponseKind(409)).toBe("conflict");
    expect(persistenceResponseKind(503)).toBe("retryable-error");
  });

  it("hydrates the layout-scoped store from a durable draft", () => {
    const store = createOrderDraftStore();
    store.getState().hydrateDurableDraft({ id: "71e9305b-56f3-4df3-85c0-bbf8ca6e2c25", version: 2, status: "active", updatedAt: "2026-08-03T12:00:00.000Z", selectedRoute: "gang-sheet", startingPointConfirmed: true, artworkAcknowledged: false, workingConfiguration: null, configuration: null, lastCompletedStep: 1 });
    expect(store.getState()).toMatchObject({ hydrationState: "ready", serverVersion: 2, selectedRoute: "gang-sheet", lastCompletedStep: 1 });
  });

  it("keeps hydration failure distinct from an absent durable draft", () => {
    const store = createOrderDraftStore();
    store.getState().markHydrationError("backend unavailable");
    expect(store.getState()).toMatchObject({ hydrationState: "error", persistenceError: "backend unavailable", serverDraftId: null });
    const empty = parseCurrentDraftResponse(200, { draft: null });
    expect(empty).toEqual({ kind: "empty" });
    expect(() => parseCurrentDraftResponse(503, { error: { code: "AUTH_VERIFICATION_FAILED", message: "retry" } })).toThrow(DraftResponseError);
    expect(() => parseCurrentDraftResponse(200, { draft: { invalid: true } })).toThrow(/invalid response/);
  });
});

describe("request protections", () => {
  it("validates same-origin state changes", () => {
    expect(isSameOriginRequest(new Request("https://example.com/api", { headers: { origin: "https://example.com" } }))).toBe(true);
    expect(isSameOriginRequest(new Request("https://example.com/api", { headers: { origin: "https://attacker.example" } }))).toBe(false);
  });

  it("rejects oversized bodies", async () => {
    await expect(readJsonBody(new Request("https://example.com", { method: "POST", body: JSON.stringify({ value: "too long" }) }), 4)).rejects.toMatchObject({ code: "BODY_TOO_LARGE" });
  });
});

describe("browser session inspection", () => {
  it("distinguishes no local session from a claims-verification failure", async () => {
    const absent = await inspectBrowserSession({ auth: { getSession: async () => ({ data: { session: null }, error: null }), getClaims: async () => { throw new Error("must not run"); } } });
    expect(absent).toEqual({ kind: "absent" });
    const failed = await inspectBrowserSession({ auth: { getSession: async () => ({ data: { session: {} }, error: null }), getClaims: async () => ({ data: null, error: new Error("temporary") }) } });
    expect(failed).toMatchObject({ kind: "error" });
  });

  it("converts thrown server Auth failures into verification errors", async () => {
    await expect(verifyOwnerWithClient(async () => { throw new Error("client creation failed"); })).resolves.toEqual({ kind: "error" });
    await expect(verifyOwnerWithClient(async () => ({
      auth: {
        getSession: async () => { throw new Error("session network failed"); },
        getClaims: async () => ({ data: null, error: null }),
      },
    }))).resolves.toEqual({ kind: "error" });
    await expect(verifyOwnerWithClient(async () => ({
      auth: {
        getSession: async () => ({ data: { session: {} }, error: null }),
        getClaims: async () => { throw new Error("claims network failed"); },
      },
    }))).resolves.toEqual({ kind: "error" });
  });
});
