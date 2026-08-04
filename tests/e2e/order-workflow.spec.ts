import { type Page } from "@playwright/test";
import { expect, monitorRuntime, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/order/start");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
  await page.getByRole("button", { name: "Acknowledge and continue" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
}

async function openCompletedStartingPoint(page: Page) {
  await page.locator('nav[aria-label="Order prototype progress"] a[href="/order/start"]').click();
  await expect(page).toHaveURL(/\/order\/start$/);
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
  await expect(page.getByText("Artwork uploading will be enabled in the next development increment.")).toBeVisible();
  await acknowledgeArtwork(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Prepare one design");
  await page.goForward();
  await expect(page).toHaveURL(/\/order\/configure$/);
  await expect(page.getByLabel("Internal design label")).toBeVisible();
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
  await page.getByRole("button", { name: "Acknowledge and continue" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
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
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
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

test("a second authenticated context cannot access the first owner's draft", async ({ page, browser }) => {
  await chooseRoute(page, "Print-ready gang sheet");
  const ownerDraft = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { id: string; version: number } };
  const secondContext = await browser.newContext();
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
      await page.getByRole("button", { name: "Acknowledge and continue" }).click();
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
