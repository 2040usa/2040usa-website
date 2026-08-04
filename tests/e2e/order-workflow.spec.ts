import { type Page } from "@playwright/test";
import { closeSync, existsSync, ftruncateSync, mkdirSync, openSync, unlinkSync, writeSync } from "node:fs";
import { Pool } from "pg";
import { expect, monitorRuntime, test } from "./fixtures";
import { getHostedTestEnvironment } from "../integration/hosted-test-environment";

test.beforeEach(async ({ page }) => {
  await page.goto("/order/start");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // The hosted Turnstile widget may keep a development connection open; the
  // visible heading and explicit draft API call below are the deterministic boundary.
  await page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string; version: number } | null };
    if (current.draft) {
      await fetch(`/api/order-drafts/${current.draft.id}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: current.draft.version }) });
    }
  });
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/How do you want to start|Initializing your draft/);
  if (await page.getByText("Initializing your draft.").isVisible().catch(() => false)) await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do you want to start?");
});

async function chooseRoute(page: Page, name: string) {
  await page.goto("/order/start");
  await page.getByLabel(new RegExp(name, "i")).check();
  await page.getByRole("button", { name: "Confirm starting point" }).click({ timeout: 40_000 });
  await expect(page).toHaveURL(/\/order\/artwork$/);
}

async function acknowledgeArtwork(page: Page) {
  await uploadArtwork(page);
  await page.getByRole("button", { name: "Continue to project details" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
}

async function uploadArtwork(page: Page, file = { name: "test-artwork.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }) {
  await page.getByLabel("Choose artwork files").setInputFiles(file);
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 30_000 });
}

function createMultiChunkPdf(name: string) {
  const fixturePath = `artifacts/playwright/${name}`;
  mkdirSync("artifacts/playwright", { recursive: true });
  const descriptor = openSync(fixturePath, "w");
  writeSync(descriptor, Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n"));
  ftruncateSync(descriptor, 7 * 1024 * 1024);
  writeSync(descriptor, Buffer.from("\n%%EOF\n"), 0, 7, 7 * 1024 * 1024 - 7);
  closeSync(descriptor);
  return fixturePath;
}

async function openCompletedStartingPoint(page: Page) {
  await page.locator('nav[aria-label="Order prototype progress"] a[href="/order/start"]').click();
  await expect(page).toHaveURL(/\/order\/start$/);
}

async function currentArtwork(page: Page) {
  return page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string } };
    return fetch(`/api/order-drafts/${current.draft.id}/artwork`, { cache: "no-store" }).then((response) => response.json()) as Promise<{ artwork: Array<{ id: string; originalName: string; status: string; version: number }>; readiness: { ready: boolean } }>;
  });
}

async function setArtworkFailureForTest(artworkId: string, failureCode: "upload_expired") {
  const pool = new Pool({ connectionString: getHostedTestEnvironment().databaseUrl });
  try {
    await pool.query("update public.artwork_files set status='failed', failure_code=$2, attempt_expires_at=now()-interval '1 minute' where id=$1", [artworkId, failureCode]);
  } finally {
    await pool.end();
  }
}

test("homepage entry points enter and preselect the order prototype", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start a Print" }).first().click();
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.getByText(/no order (will be|is) created/i)).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Start with Separate artwork" }).click();
  await expect(page).toHaveURL(/\/order\/start\?route=separate-artwork$/);
  await expect(page.getByLabel(/Separate artwork/i)).toBeChecked();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do you want to start?");
  await page.goto("/order/artwork");
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
});

test("route confirmation changes artwork guidance and browser history preserves the draft", async ({ page }) => {
  await chooseRoute(page, "Transfers by size");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prepare one design");
  await expect(page.getByRole("heading", { name: "Add artwork files" })).toBeVisible();
  await acknowledgeArtwork(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prepare one design");
  await page.goForward();
  await expect(page).toHaveURL(/\/order\/configure$/);
  await expect(page.getByLabel("Internal design label")).toBeVisible();
});

test("artwork selection rejects unsupported and oversized files before reservation", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  let reservations = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/api\/order-drafts\/[0-9a-f-]+\/artwork$/.test(new URL(request.url()).pathname)) reservations += 1;
  });

  await page.getByLabel("Choose artwork files").setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Choose a PNG, JPG, JPEG, WebP, PDF, AI, or PSD file.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload selected files" })).toBeDisabled();

  const oversizedPath = "artifacts/playwright/too-large.pdf";
  mkdirSync("artifacts/playwright", { recursive: true });
  const descriptor = openSync(oversizedPath, "w");
  ftruncateSync(descriptor, 50 * 1024 * 1024 + 1);
  closeSync(descriptor);
  try {
    await page.getByLabel("Choose artwork files").setInputFiles(oversizedPath);
    await expect(page.getByText("Each artwork file must be 50 MiB or smaller.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload selected files" })).toBeDisabled();
  } finally {
    unlinkSync(oversizedPath);
  }
  expect(reservations).toBe(0);
});

test("verified artwork restores after refresh and appears safely on Review", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  await uploadArtwork(page, { name: "front-logo.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await page.reload();
  await expect(page.getByText("front-logo.png", { exact: true })).toBeVisible();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible();
  await expect(page.getByRole("button", { name: "Load private preview of front-logo.png" })).toBeVisible();

  await page.getByRole("button", { name: "Continue to project details" }).click();
  await page.getByLabel("Internal design label").fill("Front logo");
  await page.getByLabel(/Print width/).fill("11.5");
  await page.getByLabel("Quantity").fill("24");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByRole("heading", { name: "Uploaded artwork" })).toBeVisible();
  await expect(page.getByText("front-logo.png", { exact: true })).toBeVisible();
  await expect(page.getByText(/individual design/)).toBeVisible();
  await expect(page.getByText(/Upload complete/)).toBeVisible();
  const durableText = JSON.stringify(await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())));
  expect(durableText).not.toContain("storage_path");
  expect(durableText).not.toContain("token");
});

test("a multi-chunk resumable upload exposes pause and resume controls", async ({ page }) => {
  await chooseRoute(page, "Full apparel project");
  const fixturePath = createMultiChunkPdf("multi-chunk-reference.pdf");
  let delayedPatch = false;
  await page.route("**/storage/v1/upload/resumable/**", async (route) => {
    if (!delayedPatch && route.request().method() === "PATCH") {
      delayedPatch = true;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    await route.continue().catch(() => undefined);
  });
  try {
    await page.getByLabel("Choose artwork files").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Upload selected files" }).click();
    const pause = page.getByRole("button", { name: "Pause multi-chunk-reference.pdf" });
    await expect(pause).toBeVisible({ timeout: 20_000 });
    await pause.click();
    await expect(page.getByRole("button", { name: "Resume multi-chunk-reference.pdf" })).toBeVisible();
    await page.getByRole("button", { name: "Resume multi-chunk-reference.pdf" }).click();
    await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 45_000 });
    expect(delayedPatch).toBe(true);
  } finally {
    await page.unroute("**/storage/v1/upload/resumable/**");
    unlinkSync(fixturePath);
  }
});

test("identical local files receive distinct reservation-bound TUS identities", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  const fixturePath = createMultiChunkPdf("identical-transport.pdf");
  const reservations: Array<{ artwork: { id: string }; upload: { objectName: string } }> = [];
  let tusCreations = 0;
  let releasePatches!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatches = resolve; });
  page.on("response", async (response) => {
    if (response.request().method() === "POST" && /\/api\/order-drafts\/[0-9a-f-]+\/artwork$/.test(new URL(response.url()).pathname)) {
      const body = await response.json().catch(() => null);
      if (body) reservations.push(body);
    }
  });
  await page.route("**/storage/v1/upload/resumable**", async (route) => {
    if (route.request().method() === "POST") tusCreations += 1;
    if (route.request().method() === "PATCH") await patchGate;
    await route.continue().catch(() => undefined);
  });
  try {
    await page.getByLabel("Choose artwork files").setInputFiles([fixturePath, fixturePath]);
    await page.getByRole("button", { name: "Upload selected files" }).click();
    await expect.poll(() => reservations.length, { timeout: 20_000 }).toBe(2);
    await expect.poll(() => tusCreations, { timeout: 20_000 }).toBe(2);
    await expect.poll(() => page.evaluate((artworkIds) => artworkIds.every((artworkId) => Object.keys(localStorage).some((key) => key.startsWith("tus::") && key.includes(artworkId))), reservations.map((item) => item.artwork.id)), { timeout: 20_000 }).toBe(true);
    const tusKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("tus::")));
    expect(reservations[0]?.artwork.id).not.toBe(reservations[1]?.artwork.id);
    expect(reservations[0]?.upload.objectName).not.toBe(reservations[1]?.upload.objectName);
    const identityEvidence = `Reservation IDs: ${reservations.map((item) => item.artwork.id).join(",")}; TUS keys: ${JSON.stringify(tusKeys)}`;
    expect(tusKeys.some((key) => key.includes(reservations[0]!.artwork.id)), identityEvidence).toBe(true);
    expect(tusKeys.some((key) => key.includes(reservations[1]!.artwork.id)), identityEvidence).toBe(true);
    releasePatches();
    await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => (await currentArtwork(page)).artwork.filter((record) => record.status === "uploaded").length, { timeout: 30_000 }).toBe(2);
    await page.reload();
    expect((await currentArtwork(page)).artwork.filter((record) => record.status === "uploaded")).toHaveLength(2);
  } finally {
    releasePatches();
    await page.unroute("**/storage/v1/upload/resumable**");
    unlinkSync(fixturePath);
  }
});

test("explicit unexpired recovery resumes the reservation-bound TUS identity", async ({ page }) => {
  await chooseRoute(page, "Full apparel project");
  const fixturePath = createMultiChunkPdf("resume-exact-record.pdf");
  let releasePatch!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatch = resolve; });
  let heldPatch = false;
  await page.route("**/storage/v1/upload/resumable/**", async (route) => {
    if (!heldPatch && route.request().method() === "PATCH") {
      heldPatch = true;
      await patchGate;
    }
    await route.continue().catch(() => undefined);
  });
  try {
    await page.getByLabel("Choose artwork files").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Upload selected files" }).click();
    await expect.poll(() => heldPatch, { timeout: 20_000 }).toBe(true);
    const pause = page.getByRole("button", { name: "Pause resume-exact-record.pdf" });
    await expect(pause).toBeVisible();
    await pause.click();
    const before = await currentArtwork(page);
    const pending = before.artwork[0]!;
    const storedBefore = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("tus::")));
    expect(storedBefore.some((key) => key.includes(pending.id))).toBe(true);
    releasePatch();
    await page.unroute("**/storage/v1/upload/resumable/**");
    await page.reload();
    await page.getByRole("button", { name: `Resume upload ${pending.originalName}` }).click();
    await page.getByLabel("Choose artwork files").setInputFiles(fixturePath);
    let headRequests = 0;
    page.on("request", (request) => { if (request.method() === "HEAD" && request.url().includes("/storage/v1/upload/resumable/")) headRequests += 1; });
    await page.getByRole("button", { name: "Upload selected files" }).click();
    await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 60_000 });
    const after = await currentArtwork(page);
    expect(after.artwork).toHaveLength(1);
    expect(after.artwork[0]?.id).toBe(pending.id);
    expect(headRequests).toBeGreaterThan(0);
  } finally {
    releasePatch();
    await page.unroute("**/storage/v1/upload/resumable/**").catch(() => undefined);
    unlinkSync(fixturePath);
  }
});

test("expired recovery creates a new TUS identity without touching the retained old URL", async ({ page }) => {
  await chooseRoute(page, "Full apparel project");
  const fixturePath = createMultiChunkPdf("expired-new-identity.pdf");
  let releasePatch!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatch = resolve; });
  let heldPatch = false;
  await page.route("**/storage/v1/upload/resumable/**", async (route) => {
    if (!heldPatch && route.request().method() === "PATCH") { heldPatch = true; await patchGate; }
    await route.continue().catch(() => undefined);
  });
  try {
    await page.getByLabel("Choose artwork files").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Upload selected files" }).click();
    await expect.poll(() => heldPatch, { timeout: 20_000 }).toBe(true);
    await page.getByRole("button", { name: "Pause expired-new-identity.pdf" }).click();
    const oldRecord = (await currentArtwork(page)).artwork[0]!;
    const oldEntry = await page.evaluate((artworkId) => {
      const key = Object.keys(localStorage).find((candidate) => candidate.startsWith("tus::") && candidate.includes(artworkId));
      return key ? { key, value: localStorage.getItem(key) } : null;
    }, oldRecord.id);
    expect(oldEntry).not.toBeNull();
    const oldUploadUrl = JSON.parse(oldEntry!.value!) as { uploadUrl: string };
    await setArtworkFailureForTest(oldRecord.id, "upload_expired");
    releasePatch();
    await page.unroute("**/storage/v1/upload/resumable/**");
    await page.reload();
    await page.getByRole("button", { name: `Restart expired upload ${oldRecord.originalName}` }).click();
    await page.getByLabel("Choose artwork files").setInputFiles(fixturePath);
    const postReservationRequests: Array<{ method: string; url: string }> = [];
    let newReservationId: string | null = null;
    page.on("response", async (response) => {
      if (response.request().method() === "POST" && /\/api\/order-drafts\/[0-9a-f-]+\/artwork$/.test(new URL(response.url()).pathname)) {
        const body = await response.json() as { artwork: { id: string } };
        newReservationId = body.artwork.id;
      }
    });
    page.on("request", (request) => { if (request.url().includes("/storage/v1/upload/resumable")) postReservationRequests.push({ method: request.method(), url: request.url() }); });
    await page.getByRole("button", { name: "Upload selected files" }).click();
    await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 60_000 });
    expect(newReservationId).not.toBe(oldRecord.id);
    expect(postReservationRequests.some((request) => request.method === "POST")).toBe(true);
    expect(postReservationRequests.some((request) => ["HEAD", "PATCH"].includes(request.method) && request.url === oldUploadUrl.uploadUrl)).toBe(false);
    expect((await currentArtwork(page)).artwork.map((record) => record.id)).toEqual([newReservationId]);
  } finally {
    releasePatch();
    await page.unroute("**/storage/v1/upload/resumable/**").catch(() => undefined);
    unlinkSync(fixturePath);
  }
});

test("cancel stops the browser upload and retires its pending artwork record", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  const fixturePath = createMultiChunkPdf("cancel-reference.pdf");
  await page.route("**/storage/v1/upload/resumable/**", async (route) => {
    if (route.request().method() === "PATCH") await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.continue().catch(() => undefined);
  });
  try {
    await page.getByLabel("Choose artwork files").setInputFiles(fixturePath);
    await page.getByRole("button", { name: "Upload selected files" }).click();
    await expect(page.getByText("Upload status: Transferring securely", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Cancel cancel-reference.pdf" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Cancel cancel-reference.pdf" }).click();
    await expect(page.getByText("cancel-reference.pdf", { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(async () => {
      const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string } };
      return fetch(`/api/order-drafts/${current.draft.id}/artwork`, { cache: "no-store" }).then((response) => response.json()).then((snapshot) => snapshot.artwork.length);
    }), { timeout: 10_000 }).toBe(0);
    await expect(page.getByText("Artwork is not ready yet")).toBeVisible();
  } finally {
    await page.unroute("**/storage/v1/upload/resumable/**");
    unlinkSync(fixturePath);
  }
});

test("removing the last required artwork revokes later-step access", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("1");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("link", { name: "Edit artwork" }).click();
  await page.getByRole("button", { name: "Remove test-artwork.png" }).click();
  await expect(page.getByText("Artwork is not ready yet")).toBeVisible();
  await page.goto("/order/review");
  await expect(page).toHaveURL(/\/order\/artwork$/);
});

test("artwork acknowledgment waits for the latest held draft save", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("1");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("link", { name: "Edit project details" }).click();

  let releasePatch!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatch = resolve; });
  let patchStarted = false;
  let savedVersion: number | null = null;
  let acknowledgmentVersion: number | null = null;
  let holdPatch = true;
  await page.route(/\/api\/order-drafts\/[0-9a-f-]+$/, async (route) => {
    if (holdPatch && route.request().method() === "PATCH") {
      holdPatch = false;
      patchStarted = true;
      await patchGate;
      const response = await route.fetch();
      const body = await response.json() as { draft: { version: number } };
      savedVersion = body.draft.version;
      await route.fulfill({ response, json: body });
      return;
    }
    await route.continue();
  });
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/artwork\/acknowledge$/.test(new URL(request.url()).pathname)) {
      acknowledgmentVersion = (request.postDataJSON() as { expectedDraftVersion: number }).expectedDraftVersion;
    }
  });

  await page.getByLabel("Optional project notes").fill("Held save before artwork acknowledgment");
  await expect.poll(() => patchStarted, { timeout: 10_000 }).toBe(true);
  await page.locator('nav[aria-label="Order prototype progress"] a[href="/order/artwork"]').click();
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await page.getByRole("button", { name: "Continue to project details" }).click();
  expect(acknowledgmentVersion).toBeNull();
  releasePatch();
  await expect(page).toHaveURL(/\/order\/configure$/);
  expect(acknowledgmentVersion).toBe(savedVersion);
  await page.reload();
  await expect(page.getByLabel("Optional project notes")).toHaveValue("Held save before artwork acknowledgment");
  await page.unroute(/\/api\/order-drafts\/[0-9a-f-]+$/);
});

test("removing required artwork flushes held draft state before revoking validated progress", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("1");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("link", { name: "Edit project details" }).click();

  let releasePatch!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatch = resolve; });
  let patchStarted = false;
  let savedVersion: number | null = null;
  let deletionVersion: number | null = null;
  let holdPatch = true;
  await page.route(/\/api\/order-drafts\/[0-9a-f-]+$/, async (route) => {
    if (holdPatch && route.request().method() === "PATCH") {
      holdPatch = false;
      patchStarted = true;
      await patchGate;
      const response = await route.fetch();
      const body = await response.json() as { draft: { version: number } };
      savedVersion = body.draft.version;
      await route.fulfill({ response, json: body });
      return;
    }
    await route.continue();
  });
  page.on("request", (request) => {
    if (request.method() === "DELETE" && /\/api\/artwork\/[0-9a-f-]+$/.test(new URL(request.url()).pathname)) {
      deletionVersion = (request.postDataJSON() as { expectedDraftVersion: number }).expectedDraftVersion;
    }
  });

  await page.getByLabel("Optional project notes").fill("Held save before artwork removal");
  await expect.poll(() => patchStarted, { timeout: 10_000 }).toBe(true);
  await page.locator('nav[aria-label="Order prototype progress"] a[href="/order/artwork"]').click();
  await page.getByRole("button", { name: "Remove test-artwork.png" }).click();
  expect(deletionVersion).toBeNull();
  releasePatch();
  await expect(page.getByText("Artwork is not ready yet")).toBeVisible();
  expect(deletionVersion).toBe(savedVersion);
  const canonical = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  expect(canonical).toMatchObject({ artworkAcknowledged: false, configuration: null, workingConfiguration: { notes: "Held save before artwork removal" } });
  await page.reload();
  await expect(page.getByText("Artwork is not ready yet")).toBeVisible();
  await page.unroute(/\/api\/order-drafts\/[0-9a-f-]+$/);
});

test("Transfers by Size replacement verifies a new record before removing the old one", async ({ page }) => {
  await chooseRoute(page, "Transfers by size");
  const sameFile = { name: "same-transfer.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) };
  const reservations: Array<{ artwork: { id: string }; upload: { objectName: string } }> = [];
  page.on("response", async (response) => {
    if (response.request().method() === "POST" && /\/api\/order-drafts\/[0-9a-f-]+\/artwork$/.test(new URL(response.url()).pathname)) {
      const body = await response.json().catch(() => null);
      if (body) reservations.push(body);
    }
  });
  await uploadArtwork(page, sameFile);
  const before = await page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string } };
    return fetch(`/api/order-drafts/${current.draft.id}/artwork`, { cache: "no-store" }).then((response) => response.json());
  }) as { artwork: Array<{ id: string; status: string }> };
  expect(before.artwork).toHaveLength(1);
  let upsertObserved = false;
  page.on("request", (request) => {
    if (request.url().includes("/storage/v1/upload/resumable") && request.headers()["x-upsert"] === "true") upsertObserved = true;
  });
  await page.getByLabel("Choose artwork files").setInputFiles(sameFile);
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => {
    const snapshot = await currentArtwork(page);
    return snapshot.artwork.length === 1 && snapshot.artwork[0]?.id !== before.artwork[0]?.id && snapshot.artwork[0]?.status === "uploaded";
  }, { timeout: 30_000 }).toBe(true);
  const finalSnapshot = await page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string } };
    return fetch(`/api/order-drafts/${current.draft.id}/artwork`, { cache: "no-store" }).then((response) => response.json());
  }) as { artwork: Array<{ id: string; originalName: string; status: string }> };
  expect(finalSnapshot.artwork).toHaveLength(1);
  expect(finalSnapshot.artwork[0]?.id).not.toBe(before.artwork[0]?.id);
  expect(reservations).toHaveLength(2);
  expect(reservations[0]?.artwork.id).not.toBe(reservations[1]?.artwork.id);
  expect(reservations[0]?.upload.objectName).not.toBe(reservations[1]?.upload.objectName);
  expect(upsertObserved).toBe(false);
  await page.reload();
  await expect(page.getByText("same-transfer.png", { exact: true })).toBeVisible();
});

test("reverse completion response order cannot regress canonical artwork", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let firstHeld = false;
  let secondApplied!: () => void;
  const secondResponse = new Promise<void>((resolve) => { secondApplied = resolve; });
  await page.route(/\/api\/artwork\/[0-9a-f-]+\/complete$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!firstHeld) {
      firstHeld = true;
      await firstGate;
      await route.fulfill({ response, json: body });
      return;
    }
    await route.fulfill({ response, json: body });
    secondApplied();
  });
  await page.getByLabel("Choose artwork files").setInputFiles([
    { name: "completion-one.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]) },
    { name: "completion-two.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 2]) },
  ]);
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await secondResponse;
  releaseFirst();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await currentArtwork(page)).artwork.map((record) => record.status), { timeout: 15_000 }).toEqual(["uploaded", "uploaded"]);
  await page.reload();
  expect((await currentArtwork(page)).artwork.map((record) => record.status)).toEqual(["uploaded", "uploaded"]);
  await page.unroute(/\/api\/artwork\/[0-9a-f-]+\/complete$/);
});

test("an older reconciliation response cannot overwrite a later completion", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  let releaseReconcile!: () => void;
  const reconcileGate = new Promise<void>((resolve) => { releaseReconcile = resolve; });
  let reconcileCaptured!: () => void;
  const captured = new Promise<void>((resolve) => { reconcileCaptured = resolve; });
  await page.route(/\/api\/order-drafts\/[0-9a-f-]+\/artwork\/reconcile$/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    reconcileCaptured();
    await reconcileGate;
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await captured;
  await page.getByLabel("Choose artwork files").setInputFiles({ name: "refresh-race.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 4]) });
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await expect.poll(async () => (await currentArtwork(page)).artwork[0]?.status, { timeout: 30_000 }).toBe("uploaded");
  releaseReconcile();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 15_000 });
  expect((await currentArtwork(page)).artwork[0]?.status).toBe("uploaded");
  await page.unroute(/\/api\/order-drafts\/[0-9a-f-]+\/artwork\/reconcile$/);
});

test("a partial route-cleanup response keeps the previous route and exposes retry", async ({ page, runtimeMonitor }) => {
  await chooseRoute(page, "Separate artwork");
  await uploadArtwork(page, { name: "cleanup-one.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await uploadArtwork(page, { name: "cleanup-two.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 2]) });
  await page.getByRole("button", { name: "Continue to project details" }).click();
  await page.getByLabel("Internal design label").fill("Cleanup proof");
  await page.getByLabel(/Print width/).fill("11.5");
  await page.getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Review draft" }).click();
  const canonical = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  const snapshot = await page.evaluate((draftId) => fetch(`/api/order-drafts/${draftId}/artwork`, { cache: "no-store" }).then((response) => response.json()), canonical.id) as { artwork: Array<Record<string, unknown>> };
  const preparedDraft = { ...canonical, artworkAcknowledged: false, configuration: null, version: canonical.version + 1, updatedAt: new Date().toISOString() };
  const deletingArtwork = snapshot.artwork.map((record) => ({ ...record, status: "deleting", failureCode: null, uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null, version: Number(record.version) + 1 }));
  const preparedResponse = { error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "Existing artwork could not be removed. Retry the route change." }, draft: preparedDraft, artwork: deletingArtwork, readiness: { ready: false, uploadedCount: 0, activeCount: 0, totalDeclaredBytes: 0, totalVerifiedBytes: 0 } };

  await page.goto("/order/start");
  await page.route("**/api/order-drafts/bootstrap", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify(preparedResponse) }));
  await page.route(`**/api/order-drafts/${canonical.id}/artwork`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ artwork: deletingArtwork, readiness: preparedResponse.readiness }) }));
  await page.getByLabel(/Print-ready gang sheet/i).check();
  page.once("dialog", (dialog) => dialog.accept());
  await runtimeMonitor.expectHttpFailure({ method: "POST", path: "/api/order-drafts/bootstrap", status: 503 }, async () => {
    await page.getByRole("button", { name: "Confirm starting point" }).click();
    await expect(page.getByText("Existing artwork could not be removed. Retry the route change.")).toBeVisible();
  });
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.getByText("Separate artwork", { exact: true }).last()).toBeVisible();
  await page.unroute("**/api/order-drafts/bootstrap");
  await page.unroute(`**/api/order-drafts/${canonical.id}/artwork`);
});

test("pending route selection leaves an existing durable draft unchanged until confirmation", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("4");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  const before = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));

  await page.goto("/order/start?route=separate-artwork");
  await expect(page.getByLabel(/Separate artwork/i)).toBeChecked();
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  expect(after).toEqual(before);

  await page.goto("/order/configure");
  await expect(page.getByLabel("Number of sheets")).toHaveValue("4");
});

test("same-route confirmation waits for an in-flight save without replacing local values", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByLabel("Optional project notes").fill("Initial saved state");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

  let releasePatch!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatch = resolve; });
  let markPatchStarted!: () => void;
  const patchStarted = new Promise<void>((resolve) => { markPatchStarted = resolve; });
  let holdNextPatch = true;
  let bootstrapRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/order-drafts/bootstrap") bootstrapRequests += 1;
  });
  await page.route(/\/api\/order-drafts\/[0-9a-f-]+$/, async (route) => {
    if (holdNextPatch && route.request().method() === "PATCH") {
      holdNextPatch = false;
      markPatchStarted();
      await patchGate;
    }
    await route.continue();
  });

  await page.getByLabel("Optional project notes").fill("Unsaved same-route confirmation proof");
  await patchStarted;
  await openCompletedStartingPoint(page);
  await expect(page.getByLabel(/Print-ready gang sheet/i)).toBeChecked();
  await page.getByRole("button", { name: "Confirm starting point" }).click();
  await expect(page.getByRole("button", { name: "Establishing secure draft" })).toBeDisabled();
  expect(bootstrapRequests).toBe(0);
  releasePatch();

  await expect(page).toHaveURL(/\/order\/artwork$/);
  expect(bootstrapRequests).toBe(0);
  await acknowledgeArtwork(page);
  await expect(page.getByLabel("Optional project notes")).toHaveValue("Unsaved same-route confirmation proof");
  await page.reload();
  await expect(page.getByLabel("Optional project notes")).toHaveValue("Unsaved same-route confirmation proof");
  const canonical = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  expect(canonical).toMatchObject({ selectedRoute: "gang-sheet", workingConfiguration: { notes: "Unsaved same-route confirmation proof" } });
  await page.unroute(/\/api\/order-drafts\/[0-9a-f-]+$/);
});

test("different-route confirmation waits for the latest saved version", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByLabel("Optional project notes").fill("Initial route state");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

  let releasePatch!: () => void;
  const patchGate = new Promise<void>((resolve) => { releasePatch = resolve; });
  let markPatchStarted!: () => void;
  const patchStarted = new Promise<void>((resolve) => { markPatchStarted = resolve; });
  let holdNextPatch = true;
  let savedVersion: number | null = null;
  let routeChangeVersion: number | null = null;
  await page.route(/\/api\/order-drafts\/[0-9a-f-]+$/, async (route) => {
    if (holdNextPatch && route.request().method() === "PATCH") {
      holdNextPatch = false;
      markPatchStarted();
      await patchGate;
      const response = await route.fetch();
      const body = await response.json() as { draft: { version: number } };
      savedVersion = body.draft.version;
      await route.fulfill({ response, json: body });
      return;
    }
    await route.continue();
  });
  page.on("request", (request) => {
    if (request.method() !== "POST" || new URL(request.url()).pathname !== "/api/order-drafts/bootstrap") return;
    routeChangeVersion = (request.postDataJSON() as { expectedVersion?: number }).expectedVersion ?? null;
  });

  await page.getByLabel("Optional project notes").fill("Serialized before route change");
  await patchStarted;
  await openCompletedStartingPoint(page);
  await page.getByLabel(/Separate artwork/i).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirm starting point" }).click();
  const beforeRelease = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  expect(beforeRelease).toMatchObject({ selectedRoute: "gang-sheet" });
  expect(routeChangeVersion).toBeNull();
  releasePatch();

  await expect(page).toHaveURL(/\/order\/artwork$/);
  expect(savedVersion).not.toBeNull();
  expect(routeChangeVersion).toBe(savedVersion);
  const changed = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  expect(changed).toMatchObject({ selectedRoute: "separate-artwork", workingConfiguration: null, configuration: null });
  const cleanedArtwork = await page.evaluate((draftId) => fetch(`/api/order-drafts/${draftId}/artwork`, { cache: "no-store" }).then((response) => response.json()), changed.id) as { artwork: unknown[] };
  expect(cleanedArtwork.artwork).toEqual([]);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prepare each design separately");
  await page.unroute(/\/api\/order-drafts\/[0-9a-f-]+$/);
});

test("a conflicting flush prevents route confirmation", async ({ page, runtimeMonitor }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  const draft = await page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string; version: number; selectedRoute: string; startingPointConfirmed: boolean; artworkAcknowledged: boolean; workingConfiguration: unknown; configuration: unknown } };
    await fetch(`/api/order-drafts/${current.draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: current.draft.version, selectedRoute: current.draft.selectedRoute, startingPointConfirmed: current.draft.startingPointConfirmed, artworkAcknowledged: current.draft.artworkAcknowledged, workingConfiguration: { route: "gang-sheet", sheetCount: "2", finishedWidth: "22", finishedLength: "36", notes: "Newer canonical value" }, configuration: null }) });
    return current.draft;
  });
  let routeChangeRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/order-drafts/bootstrap") routeChangeRequests += 1;
  });

  await page.getByLabel("Optional project notes").fill("Local value awaiting failed flush");
  await openCompletedStartingPoint(page);
  await page.getByLabel(/Separate artwork/i).check();
  await runtimeMonitor.expectHttpFailure({ method: "PATCH", path: `/api/order-drafts/${draft.id}`, status: 409 }, async () => {
    await page.getByRole("button", { name: "Confirm starting point" }).click();
    await expect(page.getByText("Conflict detected", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
  await expect(page).toHaveURL(/\/order\/start$/);
  expect(routeChangeRequests).toBe(0);
  const canonical = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft));
  expect(canonical).toMatchObject({ selectedRoute: "gang-sheet", workingConfiguration: { notes: "Newer canonical value" } });
});

test("a hydration failure remains an explicit retryable error", async ({ page, runtimeMonitor }) => {
  await page.route("**/api/order-drafts/current", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "AUTH_VERIFICATION_FAILED", message: "Temporary verification failure." } }) }));
  await runtimeMonitor.expectHttpFailure({ method: "GET", path: "/api/order-drafts/current", status: 503 }, () => page.reload());
  await expect(page.getByRole("heading", { level: 1, name: "Your draft could not be checked." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry draft check" }).first()).toBeVisible();
  await expect(page.locator('input[name="starting-route"]')).toHaveCount(0);
  await page.unroute("**/api/order-drafts/current");
});

test("invalid gang-sheet details block progression and a complete draft reaches Review", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("0");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
  await expect(page.locator('[role="alert"]').filter({ hasText: "Check the highlighted project details" })).toContainText("greater than zero");

  await page.getByLabel("Number of sheets").fill("3");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByLabel("Optional project notes").fill("Launch run");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review your draft.");
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("Launch run")).toBeVisible();
  await expect(page.getByRole("button", { name: /place order|submit order|pay|checkout/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Submission unavailable" })).toBeDisabled();

  await page.goBack();
  await expect(page.getByLabel("Number of sheets")).toHaveValue("3");
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("link", { name: "Edit project details" }).click();
  await expect(page.getByLabel(/Expected finished width/)).toHaveValue("22");
});

test("Review is durable before navigation and survives an immediate refresh", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByLabel("Optional project notes").fill("Immediate refresh proof");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review your draft.");
  await expect(page.getByText("Immediate refresh proof")).toBeVisible();
});

test("separate artwork supports accessible dynamic rows", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  await acknowledgeArtwork(page);
  await expect(page.getByRole("group", { name: "Design 01" })).toBeVisible();
  await page.getByRole("button", { name: "Add another design" }).click();
  await expect(page.getByRole("group", { name: "Design 02" })).toBeVisible();
  await page.getByRole("button", { name: "Remove design 2" }).click();
  await expect(page.getByRole("group", { name: "Design 02" })).toHaveCount(0);
});

test("separate artwork preserves working rows and accessible validation across Back and Forward", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await chooseRoute(page, "Separate artwork");
  await acknowledgeArtwork(page);

  await page.getByLabel("Internal design label").fill("Front logo");
  await page.getByLabel(/Print width/).fill("11.5");
  await page.getByLabel("Quantity").fill("24");
  await page.getByRole("button", { name: "Add another design" }).click();
  await page.getByLabel("Internal design label").nth(1).fill("Sleeve mark");
  await page.getByLabel(/Print width/).nth(1).fill("3.5");
  await page.getByLabel("Quantity").nth(1).fill("24");
  await page.getByLabel("Optional project notes").fill("Review artwork placement before production.");
  const rowIds = await page.locator('input[type="hidden"][name^="designs."][name$=".id"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await page.getByRole("button", { name: "Continue to project details" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
  await expect(page.getByLabel("Internal design label")).toHaveCount(2);
  expect(await page.getByLabel("Internal design label").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["Front logo", "Sleeve mark"]);
  expect(await page.getByLabel(/Print width/).evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["11.5", "3.5"]);
  expect(await page.getByLabel("Quantity").evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(["24", "24"]);
  await expect(page.getByLabel("Optional project notes")).toHaveValue("Review artwork placement before production.");
  expect(await page.locator('input[type="hidden"][name^="designs."][name$=".id"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value))).toEqual(rowIds);
  await expect(page.getByRole("listitem").filter({ hasText: "Project details" })).toContainText("Current");
  await expect(page.getByRole("listitem").filter({ hasText: "Project details" })).not.toContainText("Completed");

  const invalidLabel = page.getByRole("textbox", { name: "Internal design label", exact: true }).nth(1);
  await invalidLabel.fill("");
  await page.goBack();
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/order\/configure$/);
  const restoredInvalidLabel = page.getByRole("textbox", { name: "Internal design label", exact: true }).nth(1);
  await expect(restoredInvalidLabel).toHaveValue("");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
  await expect(restoredInvalidLabel).toHaveAccessibleName("Internal design label");
  await expect(restoredInvalidLabel).toBeFocused();
  const errorId = await restoredInvalidLabel.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`#${errorId}`)).toHaveText("Design label is required.");
  await expect(page.locator('[role="alert"]').filter({ hasText: "Check the highlighted project details" })).toBeVisible();

  await restoredInvalidLabel.fill("Sleeve mark");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByText("1. Front logo", { exact: true })).toBeVisible();
  await expect(page.getByText("2. Sleeve mark", { exact: true })).toBeVisible();
  await expect(page.getByText("Review artwork placement before production.")).toBeVisible();
  const separateGrid = page.getByTestId("configuration-summary-grid");
  const separateBoxes = await separateGrid.locator(":scope > div").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().width));
  const separateGridWidth = await separateGrid.evaluate((element) => element.getBoundingClientRect().width);
  expect(separateBoxes).toHaveLength(1);
  expect(separateBoxes[0]).toBeGreaterThan(separateGridWidth - 2);
});

test("Transfers by Size Review retains its two-group desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await chooseRoute(page, "Transfers by size");
  await acknowledgeArtwork(page);
  await page.getByLabel("Internal design label").fill("Club mark");
  await page.getByLabel(/^Width/).fill("8");
  await page.getByLabel("Quantity").fill("12");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  const summaryGrid = page.getByTestId("configuration-summary-grid");
  await expect(summaryGrid.getByRole("heading", { name: "Design", exact: true })).toBeVisible();
  await expect(summaryGrid.getByRole("heading", { name: "1 size", exact: true })).toBeVisible();
  const boxes = await summaryGrid.locator(":scope > div").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { width: box.width, top: box.top };
  }));
  expect(boxes).toHaveLength(2);
  expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(1);
  expect(Math.abs(boxes[0].width - boxes[1].width)).toBeLessThan(2);
});

test("start over deliberately resets the durable draft", async ({ page }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await page.getByLabel(/Expected finished width/).fill("20");
  await page.getByLabel(/Expected finished length/).fill("30");
  await page.getByRole("button", { name: "Review draft" }).click();
  const draftId = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft.id)) as string;
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
  const resetArtwork = await page.evaluate((id) => fetch(`/api/order-drafts/${id}/artwork`, { cache: "no-store" }).then((response) => response.json()), draftId) as { artwork: unknown[] };
  expect(resetArtwork.artwork).toEqual([]);
});

test("direct Review access redirects to the earliest incomplete step", async ({ page }) => {
  await page.goto("/order/review");
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do you want to start?");
});

test("full refresh restores saved working configuration", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  await acknowledgeArtwork(page);
  await page.getByLabel("Internal design label").fill("Front logo");
  await page.getByLabel(/Print width/).fill("11.5");
  await page.getByLabel("Quantity").fill("24");
  await page.getByRole("button", { name: "Add another design" }).click();
  await page.getByLabel("Internal design label").nth(1).fill("Sleeve mark");
  await page.getByLabel(/Print width/).nth(1).fill("3.5");
  await page.getByLabel("Quantity").nth(1).fill("24");
  await page.getByLabel("Optional project notes").fill("Review artwork placement before production.");
  const ids = await page.locator('input[type="hidden"][name^="designs."][name$=".id"]').evaluateAll((controls) => controls.map((control) => (control as HTMLInputElement).value));
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page).toHaveURL(/\/order\/configure$/);
  const restoredLabels = page.getByLabel("Internal design label");
  await expect(restoredLabels).toHaveCount(2);
  expect(await restoredLabels.evaluateAll((controls) => controls.map((control) => (control as HTMLInputElement).value))).toEqual(["Front logo", "Sleeve mark"]);
  expect(await page.locator('input[type="hidden"][name^="designs."][name$=".id"]').evaluateAll((controls) => controls.map((control) => (control as HTMLInputElement).value))).toEqual(ids);
  await expect(page.getByLabel("Optional project notes")).toHaveValue("Review artwork placement before production.");
  await page.getByLabel("Internal design label").nth(1).fill("");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel("Internal design label").nth(1)).toHaveValue("");
  await page.goto("/order/review");
  await expect(page).toHaveURL(/\/order\/configure$/);
});

test("opening and selecting Start without confirmation creates no durable identity", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("/order/start");
    await page.getByLabel(/Separate artwork/i).check();
    const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: unknown };
    expect(current.draft).toBeNull();
    expect((await context.cookies()).filter((cookie) => cookie.name.includes("auth-token"))).toHaveLength(0);
  } finally {
    await context.close();
  }
});

test("stale versions expose a conflict and Reload latest restores canonical state", async ({ page, runtimeMonitor }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.evaluate(async () => {
    const { draft } = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string; version: number; selectedRoute: "gang-sheet"; startingPointConfirmed: boolean; artworkAcknowledged: boolean; workingConfiguration: unknown; configuration: unknown } };
    await fetch(`/api/order-drafts/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: draft.version, selectedRoute: draft.selectedRoute, startingPointConfirmed: draft.startingPointConfirmed, artworkAcknowledged: draft.artworkAcknowledged, workingConfiguration: { route: "gang-sheet", sheetCount: "7", finishedWidth: "22", finishedLength: "36", notes: "Newer server value" }, configuration: null }) });
  });
  const draftId = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft.id)) as string;
  await runtimeMonitor.expectHttpFailure({ method: "PATCH", path: `/api/order-drafts/${draftId}`, status: 409 }, async () => {
    await page.getByLabel("Number of sheets").fill("3");
    await expect(page.getByText("Conflict detected", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
  await page.getByRole("button", { name: "Reload latest" }).click();
  await expect(page.getByLabel("Number of sheets")).toHaveValue("7");
});

test("stale artwork reconciliation and acknowledgment cannot adopt a newer tab version", async ({ page, runtimeMonitor, sharedContext }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  await acknowledgeArtwork(page);
  await page.getByLabel("Number of sheets").fill("2");
  await page.getByLabel(/Expected finished width/).fill("22");
  await page.getByLabel(/Expected finished length/).fill("36");
  await page.getByLabel("Optional project notes").fill("Original tab state");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);

  const staleDraft = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft)) as {
    id: string;
    version: number;
    selectedRoute: "gang-sheet";
    startingPointConfirmed: boolean;
    artworkAcknowledged: boolean;
    workingConfiguration: unknown;
    configuration: unknown;
  };
  const secondTab = await sharedContext.newPage();
  try {
    await secondTab.goto("/order/start");
    await expect(secondTab.getByRole("heading", { level: 1 })).toBeVisible();
    const advancedStatus = await secondTab.evaluate(async () => {
      const draft = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft) as {
        id: string;
        version: number;
        selectedRoute: "gang-sheet";
        startingPointConfirmed: boolean;
        artworkAcknowledged: boolean;
      };
      const configuration = { route: "gang-sheet", sheetCount: 2, finishedWidth: 22, finishedLength: 36, notes: "Newer tab state" };
      return fetch(`/api/order-drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: draft.version,
          selectedRoute: draft.selectedRoute,
          startingPointConfirmed: draft.startingPointConfirmed,
          artworkAcknowledged: draft.artworkAcknowledged,
          workingConfiguration: { route: "gang-sheet", sheetCount: "2", finishedWidth: "22", finishedLength: "36", notes: "Newer tab state" },
          configuration,
        }),
      }).then((response) => response.status);
    });
    expect(advancedStatus).toBe(200);

    await runtimeMonitor.expectHttpFailure({ method: "POST", path: `/api/order-drafts/${staleDraft.id}/artwork/reconcile`, status: 409 }, async () => {
      const status = await page.evaluate(({ id, version }) => fetch(`/api/order-drafts/${id}/artwork/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedDraftVersion: version }),
      }).then((response) => response.status), staleDraft);
      expect(status).toBe(409);
    });
    await runtimeMonitor.expectHttpFailure({ method: "POST", path: `/api/order-drafts/${staleDraft.id}/artwork/acknowledge`, status: 409 }, async () => {
      const status = await page.evaluate(({ id, version }) => fetch(`/api/order-drafts/${id}/artwork/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedDraftVersion: version }),
      }).then((response) => response.status), staleDraft);
      expect(status).toBe(409);
    });
    const canonical = await secondTab.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft)) as { artworkAcknowledged: boolean; configuration: { notes: string } };
    expect(canonical.artworkAcknowledged).toBe(true);
    expect(canonical.configuration.notes).toBe("Newer tab state");
  } finally {
    await secondTab.close();
  }
});

test("a second authenticated context cannot access the first owner's draft", async ({ page, browser }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  const ownerDraft = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { id: string; version: number } };
  const secondaryAuthStatePath = "artifacts/playwright/secondary-auth-state.json";
  const secondContext = await browser.newContext(existsSync(secondaryAuthStatePath) ? { storageState: secondaryAuthStatePath } : undefined);
  const secondPage = await secondContext.newPage();
  const secondMonitor = monitorRuntime(secondPage);
  try {
    await secondPage.goto("/order/start");
    await secondPage.getByLabel(/Separate artwork/i).check();
    await secondPage.getByRole("button", { name: "Confirm starting point" }).click({ timeout: 40_000 });
    await expect(secondPage).toHaveURL(/\/order\/artwork$/, { timeout: 10_000 });
    const response = await secondMonitor.expectHttpFailure({ method: "PATCH", path: `/api/order-drafts/${ownerDraft.draft.id}`, status: 404 }, () => secondPage.evaluate(async ({ id, version }) => fetch(`/api/order-drafts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: version, selectedRoute: "gang-sheet", startingPointConfirmed: true, artworkAcknowledged: false, workingConfiguration: null, configuration: null }) }).then((result) => result.status), ownerDraft.draft));
    expect(response.status()).toBe(404);
  } finally {
    await secondPage.evaluate(async () => {
      const { draft } = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string; version: number } | null };
      if (draft) await fetch(`/api/order-drafts/${draft.id}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: draft.version }) });
    }).catch(() => undefined);
    secondMonitor.assertClean();
    mkdirSync("artifacts/playwright", { recursive: true });
    await secondContext.storageState({ path: secondaryAuthStatePath });
    await secondContext.close();
  }
});

for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`order shell has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/order/start");
    const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.locator("h1")).toHaveCount(1);
    if (viewport.width === 360) {
      await page.getByLabel(/Full apparel project/i).check();
      await page.getByRole("button", { name: "Confirm starting point" }).click();
      await acknowledgeArtwork(page);
      await expect(page.getByLabel("Estimated garment quantity")).toBeVisible();
      const formDimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(formDimensions.scrollWidth).toBeLessThanOrEqual(formDimensions.clientWidth);
    }
  });
}

test("invalid route query is ignored safely and reduced motion remains stable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/order/start?route=checkout");
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
