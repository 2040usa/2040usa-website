import { type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { expect, test } from "./fixtures";

const png = (name: string, width = 1, height = 1) => ({ name, mimeType: "image/png", buffer: makePng(width, height) });

function makePng(width: number, height: number) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const row = Buffer.alloc(width * 4 + 1, 255); row[0] = 0;
  const image = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", image), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngChunk(type: string, data: Buffer) {
  const name = Buffer.from(type, "ascii");
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0); name.copy(output, 4); data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return output;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function resetDraft(page: Page) {
  await page.goto("/order/start");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const origin = new URL(page.url()).origin;
  let resetComplete = false;
  let lastFailure = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentResponse = await page.request.get(`${origin}/api/order-drafts/current`, { headers: { Origin: origin } });
    expect(currentResponse.ok(), "cleanup current-draft read").toBe(true);
    const current = await currentResponse.json() as { draft: { id: string; version: number } | null };
    if (!current.draft) { resetComplete = true; break; }
    const resetResponse = await page.request.post(`${origin}/api/order-drafts/${current.draft.id}/reset`, { headers: { Origin: origin }, data: { expectedVersion: current.draft.version } });
    if (resetResponse.ok()) { resetComplete = true; break; }
    lastFailure = `${resetResponse.status()} ${await resetResponse.text()}`;
    if (![409, 500, 503].includes(resetResponse.status())) break;
    await page.waitForTimeout(250 * (attempt + 1));
  }
  expect(resetComplete, `bounded draft cleanup failed: ${lastFailure}`).toBe(true);
  await page.reload();
  if (await page.getByText("Initializing your draft.").isVisible().catch(() => false)) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do you want to start?");
  }
}

test.beforeEach(async ({ page }) => {
  await resetDraft(page);
});

async function chooseRoute(page: Page, name: "Print-Ready Gang Sheet" | "Individual Designs") {
  const card = page.getByRole("button", { name: new RegExp(name, "i") });
  await expect(card).toBeEnabled({ timeout: 40_000 });
  await card.click();
  await expect(page).toHaveURL(/\/order\/artwork$/, { timeout: 40_000 });
}

async function uploadArtwork(page: Page, ...files: ReturnType<typeof png>[]) {
  await page.getByLabel("Choose artwork files").setInputFiles(files);
  await expect(page.getByRole("button", { name: "Upload selected files" })).toHaveCount(0);
  await expect(page.getByTestId("compact-artwork-uploader")).toBeVisible({ timeout: 45_000 });
  for (const file of files) {
    await expect(page.getByRole("group", { name: file.name })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByAltText(`Private preview of ${file.name}; not a print approval`).first()).toBeVisible({ timeout: 15_000 });
  }
}

async function expectCombinedWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Artwork & Layout");
  await expect(page.getByTestId("layout-preview")).toBeVisible();
}

async function openLayoutOptions(page: Page) {
  const options = page.getByTestId("layout-options");
  if (!await options.evaluate((element) => (element as HTMLDetailsElement).open)) await options.locator("summary").click();
  await expect(options).toHaveJSProperty("open", true);
}

async function configureFirstDesign(page: Page, options: { method?: "width" | "height" | "original"; dimension?: string; quantity?: string; changes?: string } = {}) {
  const method = options.method ?? "width";
  await page.getByLabel("Sizing method").first().selectOption(method);
  if (method !== "original") await page.getByLabel(method === "height" ? /Finished height/ : /Finished width/).first().fill(options.dimension ?? "11.5");
  await page.getByLabel("Quantity").first().fill(options.quantity ?? "24");
  if (options.changes) {
    await page.getByLabel("I need artwork changes").first().check();
    await page.getByLabel("Requested changes").first().fill(options.changes);
  } else {
    await page.getByLabel("Print as uploaded").first().check();
  }
}

async function configureDesignGroup(page: Page, name: string, options: { method: "width" | "height"; dimension: string; quantity: string; changes?: string }) {
  const group = page.getByRole("group", { name });
  await group.getByLabel("Sizing method").selectOption(options.method);
  await group.getByLabel(options.method === "height" ? /Finished height/ : /Finished width/).fill(options.dimension);
  await group.getByLabel("Quantity").fill(options.quantity);
  if (options.changes) {
    await group.getByLabel("I need artwork changes").check();
    await group.getByLabel("Requested changes").fill(options.changes);
  } else {
    await group.getByLabel("Print as uploaded").check();
  }
}

async function setupThreeConfiguredDesigns(page: Page, prefix: string) {
  const names = { a: `${prefix}-a.png`, b: `${prefix}-b.png`, c: `${prefix}-c.png` };
  const expectPersistedDesignCount = async (count: number) => {
    await expect.poll(async () => page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.workingConfiguration?.designs?.length))).toBe(count);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  };
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png(names.a, 2, 1));
  await expectPersistedDesignCount(1);
  await uploadArtwork(page, png(names.b, 1, 2));
  await expectPersistedDesignCount(2);
  await uploadArtwork(page, png(names.c, 3, 2));
  await expectPersistedDesignCount(3);
  await configureDesignGroup(page, names.a, { method: "width", dimension: "8", quantity: "2" });
  await configureDesignGroup(page, names.b, { method: "height", dimension: "6", quantity: "3" });
  await configureDesignGroup(page, names.c, { method: "width", dimension: "9", quantity: "4", changes: "Keep the outline and remove the background." });
  const designB = page.getByRole("group", { name: names.b });
  await designB.getByRole("button", { name: "Add another size" }).click();
  await designB.getByLabel("Sizing method").nth(1).selectOption("width");
  await designB.getByLabel(/Finished width/).fill("4");
  await designB.getByLabel("Quantity").nth(1).fill("5");
  await expect(page.getByTestId("layout-placement")).toHaveCount(14);
  await expect(page.getByTestId("selected-layout-length")).not.toHaveText("Pending");
  await expect.poll(async () => page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.workingConfiguration?.designs?.length))).toBe(3);
  return names;
}

test("homepage and Starting Point expose exactly two active routes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start with Print-Ready Gang Sheet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start with Individual Designs" })).toBeVisible();
  await expect(page.getByText(/Full Apparel|Separate Artwork|Transfers by Size/i)).toHaveCount(0);

  await page.getByRole("link", { name: "Start with Individual Designs" }).click();
  await expect(page).toHaveURL(/\/order\/start\?route=individual-designs$/);
  await expect(page.getByRole("button", { name: /Individual Designs/i })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Confirm starting point|Continue/i })).toHaveCount(0);
  const progress = page.getByRole("navigation", { name: "Order draft progress" });
  await expect(progress.getByRole("listitem")).toHaveCount(3);
  await expect(progress.getByText("Artwork & Layout", { exact: true })).toBeVisible();
  await expect(progress.getByText("Project details", { exact: true })).toHaveCount(0);
  const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: null | { selectedRoute: string | null; startingPointConfirmed: boolean } };
  expect(current.draft === null || (current.draft.selectedRoute === null && current.draft.startingPointConfirmed === false)).toBe(true);
  await page.goto("/order/artwork");
  await expect(page).toHaveURL(/\/order\/start$/);
});

test("route-card activation durably establishes each route before navigation", async ({ page }) => {
  await chooseRoute(page, "Print-Ready Gang Sheet");
  await expect(page.getByText("Step 2 · Print-Ready Gang Sheet", { exact: true })).toBeVisible();
  let current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { selectedRoute: string; startingPointConfirmed: boolean } };
  expect(current.draft).toMatchObject({ selectedRoute: "gang-sheet", startingPointConfirmed: true });

  await resetDraft(page);
  await chooseRoute(page, "Individual Designs");
  await expect(page.getByText("Step 2 · Individual Designs", { exact: true })).toBeVisible();
  current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()));
  expect(current.draft).toMatchObject({ selectedRoute: "individual-designs", startingPointConfirmed: true });
});

test("legacy Project Details URL redirects to the canonical Artwork & Layout workspace", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await expect(page.getByRole("heading", { name: "Add artwork" })).toBeVisible();
  await expect(page.getByTestId("artwork-requirements")).toHaveJSProperty("open", false);
  await page.getByTestId("artwork-requirements").locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("artwork-requirements")).toHaveJSProperty("open", true);
  await expect(page.getByTestId("artwork-requirements")).toContainText("PNG, JPG, JPEG, WebP, PDF, AI, or PSD");
  await page.getByRole("button", { name: "Choose files" }).focus();
  await expect(page.getByRole("button", { name: "Choose files" })).toBeFocused();
  await page.getByRole("button", { name: "Drop files here or press Enter" }).focus();
  await expect(page.getByRole("button", { name: "Drop files here or press Enter" })).toBeFocused();
  await page.goto("/order/configure");
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Artwork & Layout");
  await expect(page.getByText("Project details", { exact: true })).toHaveCount(0);
});

test("a failed route establishment stays retryable on Starting Point", async ({ page, runtimeMonitor }) => {
  await page.route("**/api/order-drafts/bootstrap", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVER_ERROR", message: "Temporary draft failure." } }) }));
  await runtimeMonitor.expectHttpFailure({ method: "POST", path: "/api/order-drafts/bootstrap", status: 503 }, async () => {
    const card = page.getByRole("button", { name: /Individual Designs/i });
    await expect(card).toBeEnabled({ timeout: 40_000 });
    await card.click();
  });
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.getByRole("alert").filter({ hasText: "Temporary draft failure" })).toBeVisible();
  await page.unroute("**/api/order-drafts/bootstrap");
  await page.getByRole("button", { name: /Individual Designs/i }).click();
  await expect(page).toHaveURL(/\/order\/artwork$/, { timeout: 40_000 });
});

test("populated route changes require confirmation and clean only after acceptance", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("keep-until-confirmed.png"));
  await page.goto("/order/start");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /Print-Ready Gang Sheet/i }).click();
  await expect(page).toHaveURL(/\/order\/start$/);
  const retained = await page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string } };
    return fetch(`/api/order-drafts/${current.draft.id}/artwork`, { cache: "no-store" }).then((response) => response.json()) as Promise<{ artwork: unknown[] }>;
  });
  expect(retained.artwork).toHaveLength(1);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Print-Ready Gang Sheet/i }).click();
  await expect(page).toHaveURL(/\/order\/artwork$/, { timeout: 40_000 });
  await expect(page.getByText("keep-until-confirmed.png", { exact: true })).toHaveCount(0);
});

test("selection previews locally, auto-starts, and keeps reservation failure retryable", async ({ page, runtimeMonitor }) => {
  await chooseRoute(page, "Individual Designs");
  await page.evaluate(() => {
    const trackedWindow = window as typeof window & { __revokedArtworkPreviewUrls?: string[] };
    trackedWindow.__revokedArtworkPreviewUrls = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => { trackedWindow.__revokedArtworkPreviewUrls?.push(url); revoke(url); };
  });
  const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { id: string } };
  let failedReservation = false;
  await page.route("**/api/order-drafts/*/artwork", async (route) => {
    if (route.request().method() !== "POST" || failedReservation) return route.continue();
    failedReservation = true;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "SERVER_ERROR", message: "Temporary reservation failure." } }) });
  });
  await runtimeMonitor.expectHttpFailure({ method: "POST", path: `/api/order-drafts/${current.draft.id}/artwork`, status: 503 }, async () => {
    await page.getByLabel("Choose artwork files").setInputFiles(png("automatic-preview.png"));
  });
  await expect(page.getByAltText("Local preview of automatic-preview.png; not a print approval")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Temporary reservation failure" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to Review" })).toHaveCount(0);
  await expect(page.getByTestId("layout-preview")).toHaveCount(0);
  await page.unroute("**/api/order-drafts/*/artwork");
  await page.getByRole("button", { name: "Retry reservation for automatic-preview.png" }).click();
  await expect(page.getByTestId("compact-artwork-uploader")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByAltText("Private preview of automatic-preview.png; not a print approval").first()).toBeVisible({ timeout: 15_000 });
  await expectCombinedWorkspace(page);
  expect(await page.evaluate(() => (window as typeof window & { __revokedArtworkPreviewUrls?: string[] }).__revokedArtworkPreviewUrls?.length ?? 0)).toBeGreaterThan(0);
});

test("uploaded artwork collapses the large uploader while Add Another Design keeps automatic upload available", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await expect(page.getByRole("heading", { name: "Add artwork" })).toBeVisible();
  await uploadArtwork(page, png("first-design.png"));
  await expect(page.getByRole("heading", { name: "Add artwork" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add another design" })).toBeVisible();
  await page.getByLabel("Choose artwork files").setInputFiles(png("second-design.png"));
  await expect(page.getByText("2 designs uploaded")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("group", { name: "first-design.png" })).toBeVisible();
  await expect(page.getByRole("group", { name: "second-design.png" })).toBeVisible();
});

test("Individual Designs links every upload to multiple size variants and requested changes", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("front-logo.png"), png("sleeve-mark.png"));
  await expectCombinedWorkspace(page);
  await expect(page.getByRole("group", { name: "front-logo.png" })).toBeVisible();
  await expect(page.getByRole("group", { name: "sleeve-mark.png" })).toBeVisible();

  await configureFirstDesign(page, { method: "width", dimension: "11.5", quantity: "24", changes: "Remove the background and crop close." });
  await page.getByRole("button", { name: "Add another size" }).first().click();
  await page.getByLabel("Sizing method").nth(1).selectOption("height");
  await page.getByLabel(/Finished height/).fill("8");
  await page.getByLabel("Quantity").nth(1).fill("6");
  await page.getByLabel("Sizing method").nth(2).selectOption("original");
  await page.getByLabel("Quantity").nth(2).fill("3");
  await page.getByLabel("Print as uploaded").nth(1).check();

  await expect(page.getByTestId("layout-preview")).toContainText("Could not generate the complete preview");
  await expect(page.getByTestId("layout-preview")).toContainText("Original Size needs confirmed physical dimensions");
  await expect(page.getByTestId("selected-layout-length")).toHaveText("Pending");
  await expect(page.getByTestId("layout-preview")).not.toContainText(/utilization|\$\d/i);
  await expect(page.getByTestId("layout-preview")).toContainText("33");

  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByRole("heading", { name: "front-logo.png" })).toBeVisible();
  await expect(page.getByText("Set by width: 11.5 in · quantity 24")).toBeVisible();
  await expect(page.getByText("Set by height: 8 in · quantity 6")).toBeVisible();
  await expect(page.getByText("Use original artwork size · quantity 3")).toBeVisible();
  await expect(page.getByText("Remove the background and crop close.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "front-logo.png" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit Artwork & Layout" })).toHaveAttribute("href", "/order/artwork");
  await expect(page.getByRole("link", { name: "Edit artwork", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit project details", exact: true })).toHaveCount(0);
  await expect(page.getByText(/price, payment, or production request/i)).toBeVisible();
  await page.getByRole("link", { name: "Edit Artwork & Layout" }).click();
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("group", { name: "front-logo.png" })).toBeVisible();
});

test("Individual Designs generates, compares, persists, and reviews deterministic layouts", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("wide-design.png", 2, 1), png("tall-design.png", 1, 2));
  await expect(page.getByTestId("layout-options")).toHaveJSProperty("open", false);
  await expect(page.getByTestId("layout-options")).toContainText('Most Cost Efficient · 0.25" spacing');
  await openLayoutOptions(page);
  await expect(page.getByLabel("Most Cost Efficient")).toBeChecked();
  await expect(page.getByLabel(/Standard/)).toBeChecked();

  await configureFirstDesign(page, { method: "width", dimension: "10", quantity: "3" });
  await page.getByLabel("Sizing method").nth(1).selectOption("height");
  await page.getByLabel(/Finished height/).nth(0).fill("8");
  await page.getByLabel("Quantity").nth(1).fill("4");
  await page.getByLabel("Print as uploaded").nth(1).check();

  await expect(page.getByTestId("gang-sheet-graphic")).toBeVisible();
  await expect(page.getByTestId("layout-placement")).toHaveCount(7);
  await expect(page.getByTestId("layout-comparison")).toBeVisible();
  const efficient = Number((await page.getByTestId("selected-layout-length").textContent())?.replace(/[^0-9.]/g, ""));
  const comparisonText = await page.getByTestId("layout-comparison").textContent() ?? "";
  const groupedFromComparison = Number(comparisonText.match(/Keep Designs Together[^0-9]*([0-9.]+)/)?.[1]);
  expect(efficient).toBeLessThanOrEqual(groupedFromComparison);

  await page.getByLabel("Keep Designs Together").check();
  await expect(page.getByTestId("gang-sheet-graphic").locator("svg")).toHaveAttribute("data-layout-mode", "grouped");
  await expect(page.getByTestId("layout-group-band")).toHaveCount(2);
  const grouped = await page.getByTestId("selected-layout-length").textContent();

  await page.getByLabel("Most Cost Efficient").check();
  await expect(page.getByTestId("gang-sheet-graphic").locator("svg")).toHaveAttribute("data-layout-mode", "efficient");
  await page.getByLabel("Keep Designs Together").check();

  await page.getByLabel("Custom").check();
  await page.getByLabel(/Custom spacing/).fill("0.375");
  await expect(page.getByTestId("layout-options")).toContainText('0.375" spacing');
  await page.getByLabel(/Extra/).check();
  await expect(page.getByTestId("selected-layout-length")).not.toHaveText(grouped ?? "");
  const extraLength = await page.getByTestId("selected-layout-length").textContent();
  await page.getByLabel("Quantity").first().fill("5");
  await expect(page.getByTestId("layout-placement")).toHaveCount(9);
  await expect(page.getByTestId("selected-layout-length")).not.toHaveText(extraLength ?? "");

  await expect.poll(async () => page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.workingConfiguration?.layoutPreferences))).toEqual({ mode: "grouped", spacingPreset: "extra", customSpacing: "0.375" });
  await page.reload();
  await openLayoutOptions(page);
  await expect(page.getByLabel("Keep Designs Together")).toBeChecked();
  await expect(page.getByLabel(/Extra/)).toBeChecked();
  await expect(page.getByTestId("gang-sheet-graphic")).toBeVisible();

  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByTestId("layout-preview")).toContainText("Keep Designs Together");
  await expect(page.getByTestId("layout-preview")).toContainText('0.5" spacing');
  await expect(page.getByTestId("selected-layout-length")).not.toHaveText("Pending");
  await expect(page.getByTestId("layout-preview")).not.toContainText(/\$\d|checkout|payment/i);
  const completed = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.configuration));
  expect(completed.layoutPreferences).toEqual({ mode: "grouped", spacing: 0.5 });
  expect(JSON.stringify(completed)).not.toContain("placements");
});

test("layout preview rotates fitting artwork and reports oversize geometry honestly", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("rotation-design.png", 2, 1));
  await configureFirstDesign(page, { method: "width", dimension: "24", quantity: "1" });
  await expect(page.getByTestId("layout-placement")).toHaveAttribute("data-rotation", "90");
  await page.getByLabel(/Finished width/).fill("50");
  await expect(page.getByText(/Neither 0° nor 90° orientation fits/)).toBeVisible();
  await expect(page.getByTestId("selected-layout-length")).toHaveText("Pending");
  await expect.poll(async () => page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.workingConfiguration?.designs?.[0]?.sizes?.[0]?.dimension))).toBe("50");
});

test("configuration validation protects sizing exclusivity and change instructions", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("validation.png"));
  await expectCombinedWorkspace(page);
  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page.getByLabel("Sizing method")).toBeFocused();
  await expect(page.locator('[id="designs.0.sizes.0-method-error"]')).toHaveText("Choose one sizing method.");
  await page.getByLabel("Sizing method").selectOption("original");
  await page.getByLabel("Quantity").fill("0");
  await page.getByLabel("I need artwork changes").check();
  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page.locator('[id="designs.0.sizes.0-quantity-error"]')).toContainText("whole-number quantity");
  await expect(page.locator('[id="design-0-instructions-error"]')).toHaveText("Describe the changes you want us to review.");
});

test("deletion prunes its artwork-linked working configuration", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("delete-me.png"), png("keep-me.png"));
  await expectCombinedWorkspace(page);
  await configureFirstDesign(page);
  await page.getByLabel("Sizing method").nth(1).selectOption("height");
  await page.getByLabel(/Finished height/).fill("5");
  await page.getByLabel("Quantity").nth(1).fill("7");
  await page.getByLabel("Print as uploaded").nth(1).check();
  await expect(page.getByTestId("layout-placement")).toHaveCount(31);
  const lengthBeforeRemoval = await page.getByTestId("selected-layout-length").textContent();
  await page.getByRole("button", { name: "Remove delete-me.png" }).click();
  await expect(page.getByText("delete-me.png", { exact: true })).toHaveCount(0);
  await page.goto("/order/configure");
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("group", { name: "keep-me.png" })).toBeVisible();
  await expect(page.getByRole("group", { name: "delete-me.png" })).toHaveCount(0);
  await expect(page.getByTestId("layout-placement")).toHaveCount(7);
  await expect(page.getByTestId("selected-layout-length")).not.toHaveText(lengthBeforeRemoval ?? "");
});

test("removing the first of three configured designs preserves the exact surviving form and draft state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const draftErrors: Array<{ method: string; status: number; code?: string; message?: string; designShape?: unknown }> = [];
  page.on("response", async (response) => {
    if (response.status() < 500 || !new URL(response.url()).pathname.startsWith("/api/order-drafts/")) return;
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    const requestBody = response.request().postDataJSON() as { workingConfiguration?: { designs?: Array<{ artworkId?: unknown; sizes?: Array<{ id?: unknown; method?: unknown; dimension?: unknown; quantity?: unknown }>; wantsChanges?: unknown; changeInstructions?: unknown }> } } | null;
    draftErrors.push({
      method: response.request().method(),
      status: response.status(),
      code: body?.error?.code,
      message: body?.error?.message,
      designShape: requestBody?.workingConfiguration?.designs?.map((design) => ({
        hasArtworkId: typeof design.artworkId === "string",
        sizes: design.sizes?.map((size) => ({ hasId: typeof size.id === "string", method: size.method, dimension: size.dimension, quantity: size.quantity })),
        wantsChanges: design.wantsChanges,
        hasChangeInstructions: typeof design.changeInstructions === "string",
      })),
    });
  });
  const names = await setupThreeConfiguredDesigns(page, "first-remove");
  expect(draftErrors).toEqual([]);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const before = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { id: string; workingConfiguration: { designs: Array<{ artworkId: string }> } } };
  const artworkSnapshot = await page.evaluate((draftId) => fetch(`/api/order-drafts/${draftId}/artwork`, { cache: "no-store" }).then((response) => response.json()), before.draft.id) as { artwork: Array<{ id: string; originalName: string }> };
  const idsByName = new Map(artworkSnapshot.artwork.map((record) => [record.originalName, record.id]));
  const patchPayloads: unknown[] = [];
  let deletionStarted = false;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "DELETE" && path.startsWith("/api/artwork/")) deletionStarted = true;
    if (deletionStarted && request.method() === "PATCH" && path === `/api/order-drafts/${before.draft.id}`) patchPayloads.push(request.postDataJSON());
  });

  const deletionResponsePromise = page.waitForResponse((response) => response.request().method() === "DELETE" && new URL(response.url()).pathname.startsWith("/api/artwork/"));
  await page.getByRole("button", { name: `Remove ${names.a}` }).click();
  const deletionResponse = await deletionResponsePromise;
  expect(deletionResponse.ok()).toBe(true);
  const deletionBody = await deletionResponse.json() as { draft: { workingConfiguration: { designs: Array<{ artworkId: string }> } } };
  expect(deletionBody.draft.workingConfiguration.designs.map((design) => design.artworkId)).toEqual([idsByName.get(names.b), idsByName.get(names.c)]);

  await expect(page.getByRole("group", { name: names.a })).toHaveCount(0);
  const designB = page.getByRole("group", { name: names.b });
  const designC = page.getByRole("group", { name: names.c });
  await expect(designB).toBeVisible();
  await expect(designC).toBeVisible();
  await expect(page.getByLabel("Sizing method")).toHaveCount(3);
  await expect(page.getByLabel("Quantity")).toHaveCount(3);
  await page.getByLabel("Optional project notes").fill("Saved after removing the first design.");
  await expect.poll(() => patchPayloads.length).toBeGreaterThan(0);
  for (const payload of patchPayloads as Array<{ workingConfiguration?: { designs?: Array<{ artworkId?: string; sizes?: Array<{ id?: string; quantity?: string }> }> } }>) {
    expect(payload.workingConfiguration?.designs).toHaveLength(2);
    expect(payload.workingConfiguration?.designs?.map((design) => design.artworkId)).toEqual([idsByName.get(names.b), idsByName.get(names.c)]);
    expect(payload.workingConfiguration?.designs?.every((design) => design.artworkId && design.sizes?.every((size) => size.id && size.quantity))).toBe(true);
  }
  await expect(designB.getByLabel("Sizing method").nth(0)).toHaveValue("height");
  await expect(designB.getByLabel("Quantity").nth(0)).toHaveValue("3");
  await expect(designB.getByLabel("Sizing method").nth(1)).toHaveValue("width");
  await expect(designB.getByLabel("Quantity").nth(1)).toHaveValue("5");
  await expect(designC.getByLabel("Quantity")).toHaveValue("4");
  await expect(designC.getByLabel("I need artwork changes")).toBeChecked();
  await expect(designC.getByLabel("Requested changes")).toHaveValue("Keep the outline and remove the background.");
  await expect(page.getByTestId("layout-placement")).toHaveCount(12);
  await expect(page.getByTestId("selected-layout-length")).not.toHaveText("Pending");
  await expect(page.getByText("Could not generate the complete preview")).toHaveCount(0);
  await expect(page.getByText("Unable to save", { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(draftErrors).toEqual([]);
  await page.reload();
  await expect(page.getByRole("group", { name: names.b }).getByLabel("Quantity").nth(0)).toHaveValue("3");
  await expect(page.getByRole("group", { name: names.b }).getByLabel("Quantity").nth(1)).toHaveValue("5");
  await expect(page.getByRole("group", { name: names.c }).getByLabel("Requested changes")).toHaveValue("Keep the outline and remove the background.");
  await page.waitForTimeout(100);
  expect(draftErrors).toEqual([]);
});

for (const position of ["middle", "last"] as const) {
  test(`removing the ${position} of three configured designs preserves the other artwork`, async ({ page }) => {
    const draftErrors: Array<{ method: string; status: number; code?: string; message?: string }> = [];
    page.on("response", async (response) => {
      if (response.status() < 500 || !new URL(response.url()).pathname.startsWith("/api/order-drafts/")) return;
      const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      draftErrors.push({ method: response.request().method(), status: response.status(), code: body?.error?.code, message: body?.error?.message });
    });
    const names = await setupThreeConfiguredDesigns(page, `${position}-remove`);
    expect(draftErrors).toEqual([]);
    const removedName = position === "middle" ? names.b : names.c;
    const survivors = position === "middle" ? [names.a, names.c] : [names.a, names.b];
    const expectedPlacements = position === "middle" ? 6 : 10;

    await page.getByRole("button", { name: `Remove ${removedName}` }).click();
    await expect(page.getByRole("group", { name: removedName })).toHaveCount(0);
    await expect(page.getByRole("group", { name: survivors[0] })).toBeVisible();
    await expect(page.getByRole("group", { name: survivors[1] })).toBeVisible();
    await expect(page.getByTestId("layout-placement")).toHaveCount(expectedPlacements);
    await expect(page.getByTestId("selected-layout-length")).not.toHaveText("Pending");
    await expect(page.getByText("Could not generate the complete preview")).toHaveCount(0);
    await expect(page.getByText("Unable to save", { exact: true })).toHaveCount(0);
    await expect.poll(async () => page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.workingConfiguration?.designs))).toHaveLength(2);

    if (position === "middle") {
      await expect(page.getByRole("group", { name: names.a }).getByLabel("Quantity")).toHaveValue("2");
      await expect(page.getByRole("group", { name: names.c }).getByLabel("Quantity")).toHaveValue("4");
      await expect(page.getByRole("group", { name: names.c }).getByLabel("Requested changes")).toHaveValue("Keep the outline and remove the background.");
    } else {
      await expect(page.getByRole("group", { name: names.b }).getByLabel("Quantity").nth(0)).toHaveValue("3");
      await expect(page.getByRole("group", { name: names.b }).getByLabel("Quantity").nth(1)).toHaveValue("5");
    }

    await page.reload();
    await expect(page.getByRole("group", { name: removedName })).toHaveCount(0);
    await expect(page.getByRole("group", { name: survivors[0] })).toBeVisible();
    await expect(page.getByRole("group", { name: survivors[1] })).toBeVisible();
    await expect(page.getByTestId("layout-placement")).toHaveCount(expectedPlacements);
    await page.waitForTimeout(100);
    expect(draftErrors).toEqual([]);
  });
}

test("sequentially removing the new first design reaches the canonical empty state", async ({ page }) => {
  const names = await setupThreeConfiguredDesigns(page, "sequential-remove");

  await page.getByRole("button", { name: `Remove ${names.a}` }).click();
  await expect(page.getByRole("group", { name: names.a })).toHaveCount(0);
  await expect(page.getByTestId("layout-placement")).toHaveCount(12);

  await page.getByRole("button", { name: `Remove ${names.b}` }).click();
  await expect(page.getByRole("group", { name: names.b })).toHaveCount(0);
  await expect(page.getByRole("group", { name: names.c }).getByLabel("Quantity")).toHaveValue("4");
  await expect(page.getByTestId("layout-placement")).toHaveCount(4);

  await page.getByRole("button", { name: `Remove ${names.c}` }).click();
  await expect(page.getByRole("group", { name: names.c })).toHaveCount(0);
  await expect(page.getByTestId("layout-preview")).toHaveCount(0);
  await expect(page.getByTestId("empty-artwork-uploader")).toBeVisible();
  await expect(page.getByText("Unable to save", { exact: true })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()).then((body) => body.draft?.workingConfiguration?.designs ?? []))).toEqual([]);

  await page.reload();
  await expect(page.getByTestId("layout-preview")).toHaveCount(0);
  await expect(page.getByTestId("empty-artwork-uploader")).toBeVisible();
});

test("removing the final configured design leaves a durable empty artwork state", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("remove-final.png", 2, 1));
  await configureFirstDesign(page, { method: "width", dimension: "8", quantity: "4" });
  await expect(page.getByTestId("layout-placement")).toHaveCount(4);

  await page.getByRole("button", { name: "Remove remove-final.png" }).click();
  await expect(page.getByText("remove-final.png", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("layout-preview")).toHaveCount(0);
  await expect(page.getByTestId("empty-artwork-uploader")).toBeVisible();

  await page.reload();
  await expect(page.getByText("remove-final.png", { exact: true })).toHaveCount(0);
  const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as {
    draft: { workingConfiguration: { designs: unknown[] } | null; configuration: unknown };
  };
  expect(current.draft.workingConfiguration?.designs ?? []).toEqual([]);
  expect(current.draft.configuration).toBeNull();
});

test("removing artwork after Review completion clears the completed layout safely", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("remove-after-review.png", 2, 1));
  await configureFirstDesign(page, { method: "width", dimension: "8", quantity: "4" });
  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await page.getByRole("link", { name: "Edit Artwork & Layout" }).click();
  await expect(page).toHaveURL(/\/order\/artwork$/);

  await page.getByRole("button", { name: "Remove remove-after-review.png" }).click();
  await expect(page.getByText("remove-after-review.png", { exact: true })).toHaveCount(0);
  const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as {
    draft: { artworkAcknowledged: boolean; workingConfiguration: { designs: unknown[] } | null; configuration: unknown };
  };
  expect(current.draft.artworkAcknowledged).toBe(false);
  expect(current.draft.workingConfiguration?.designs ?? []).toEqual([]);
  expect(current.draft.configuration).toBeNull();
});

test("removing configured print-ready artwork preserves only the remaining sheets", async ({ page }) => {
  await chooseRoute(page, "Print-Ready Gang Sheet");
  await uploadArtwork(page, png("remove-sheet.png"), png("keep-sheet.png"));
  await page.getByLabel(/Finished width/).nth(0).fill("22");
  await page.getByLabel(/Finished length/).nth(0).fill("18");
  await page.getByLabel("Copies").nth(0).fill("2");
  await page.getByLabel(/Finished width/).nth(1).fill("20");
  await page.getByLabel(/Finished length/).nth(1).fill("12");
  await page.getByLabel("Copies").nth(1).fill("3");

  await page.getByRole("button", { name: "Remove remove-sheet.png" }).click();
  await expect(page.getByText("remove-sheet.png", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "keep-sheet.png" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("remove-sheet.png", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel(/Finished width/)).toHaveValue("20");
  await expect(page.getByLabel(/Finished length/)).toHaveValue("12");
  await expect(page.getByLabel("Copies")).toHaveValue("3");

  await page.getByRole("button", { name: "Remove keep-sheet.png" }).click();
  await expect(page.getByText("keep-sheet.png", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("layout-preview")).toHaveCount(0);
  await expect(page.getByTestId("empty-artwork-uploader")).toBeVisible();
});

test("a genuine artwork deletion failure stays recoverable without an uncaught browser error", async ({ page, runtimeMonitor }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("delete-retry.png"));
  const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: Record<string, unknown> & { id: string } };
  const snapshot = await page.evaluate((draftId) => fetch(`/api/order-drafts/${draftId}/artwork`, { cache: "no-store" }).then((response) => response.json()), current.draft.id) as { artwork: Array<Record<string, unknown> & { id: string; version: number }>; readiness: Record<string, unknown> };
  const deletionPath = `/api/artwork/${snapshot.artwork[0].id}`;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(`**${deletionPath}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "ARTWORK_CLEANUP_INCOMPLETE", message: "The artwork object could not be removed. Retry deletion." },
        artwork: [{ ...snapshot.artwork[0], status: "deleting", uploadedAt: null, verifiedSizeBytes: null, verifiedMimeType: null, version: snapshot.artwork[0].version + 1 }],
        readiness: { ...snapshot.readiness, ready: false, uploadedCount: 0, totalVerifiedBytes: 0 },
        draft: current.draft,
      }),
    });
  });

  await runtimeMonitor.expectHttpFailure({ method: "DELETE", path: deletionPath, status: 503 }, async () => {
    await page.getByRole("button", { name: "Remove delete-retry.png" }).click();
  });
  await expect(page.getByText("The artwork object could not be removed. Retry deletion.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry delete delete-retry.png" })).toBeVisible();
  await expect.poll(() => pageErrors).toEqual([]);
});

test("replacement uses a new canonical record and preserves design details", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("old-design.png"));
  await expectCombinedWorkspace(page);
  await configureFirstDesign(page, { method: "height", dimension: "9", quantity: "12", changes: "Adjust the blue text." });
  await openLayoutOptions(page);
  await page.getByLabel("Keep Designs Together").check();
  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByText("Set by height: 9 in · quantity 12")).toBeVisible();
  await expect(page.getByText("Adjust the blue text.")).toBeVisible();
  const completedDraft = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { workingConfiguration: { designs: Array<{ sizes: Array<{ method: string; dimension: string; quantity: string }>; changeInstructions: string }> } } };
  expect(completedDraft.draft.workingConfiguration.designs[0]).toMatchObject({ sizes: [{ method: "height", dimension: "9", quantity: "12" }], changeInstructions: "Adjust the blue text." });
  await page.goto("/order/artwork");
  await expect(page.getByLabel(/Finished height/)).toHaveValue("9");
  await expect(page.getByLabel("Quantity")).toHaveValue("12");
  await expect(page.getByLabel("Requested changes")).toHaveValue("Adjust the blue text.");
  await openLayoutOptions(page);
  await expect(page.getByLabel("Keep Designs Together")).toBeChecked();
  await expect(page.getByTestId("layout-placement")).toHaveCount(12);
  await page.getByRole("button", { name: "Replace old-design.png" }).click();
  await page.getByLabel("Choose artwork files").setInputFiles(png("new-design.png"));
  await expect(page.getByText("new-design.png", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("old-design.png", { exact: true })).toHaveCount(0);
  const reboundDraft = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { workingConfiguration: { designs: Array<{ sizes: Array<{ method: string; dimension: string; quantity: string }>; changeInstructions: string }> } } };
  expect(reboundDraft.draft.workingConfiguration.designs[0]).toMatchObject({ sizes: [{ method: "height", dimension: "9", quantity: "12" }], changeInstructions: "Adjust the blue text." });
  await expectCombinedWorkspace(page);
  await expect(page.getByRole("group", { name: "new-design.png" })).toBeVisible();
  await expect(page.getByLabel(/Finished height/)).toHaveValue("9");
  await expect(page.getByLabel("Quantity")).toHaveValue("12");
  await expect(page.getByLabel("Requested changes")).toHaveValue("Adjust the blue text.");
});

test("Print-Ready Gang Sheet configures and reviews every uploaded file", async ({ page }) => {
  await chooseRoute(page, "Print-Ready Gang Sheet");
  await uploadArtwork(page, png("arranged-sheet.png"), png("second-sheet.png"));
  await expectCombinedWorkspace(page);
  await expect(page.getByRole("group", { name: "arranged-sheet.png" })).toBeVisible();
  await expect(page.getByRole("group", { name: "second-sheet.png" })).toBeVisible();
  await page.getByLabel("Copies").nth(0).fill("3");
  await page.getByLabel(/finished width/i).nth(0).fill("22");
  await page.getByLabel(/finished length/i).nth(0).fill("48");
  await page.getByLabel("Copies").nth(1).fill("2");
  await page.getByLabel(/finished width/i).nth(1).fill("24");
  await page.getByLabel(/finished length/i).nth(1).fill("60");
  await expect(page.getByTestId(/gang-sheet-preview-/)).toHaveCount(2);
  await expect(page.getByText("Layout Preference", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Spacing Between Transfers", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId(/gang-sheet-preview-/).nth(0).getByAltText("Private preview of arranged-sheet.png; not a print approval")).toBeVisible();
  await expect(page.getByTestId(/gang-sheet-preview-/).nth(1).getByAltText("Private preview of second-sheet.png; not a print approval")).toBeVisible();
  await expect(page.getByTestId(/gang-sheet-preview-/).nth(0)).toContainText("22 in × 48 in");
  await expect(page.getByTestId(/gang-sheet-preview-/).nth(1)).toContainText("24 in × 60 in");
  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page.getByRole("heading", { name: "arranged-sheet.png" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "second-sheet.png" })).toBeVisible();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("22 in × 48 in", { exact: true })).toBeVisible();
  await expect(page.getByText("24 in × 60 in", { exact: true })).toBeVisible();
  await expect(page.getByText(/does not calculate a price, accept payment, or submit an order/i)).toBeVisible();
});

for (const width of [360, 768, 1440]) {
  test(`Individual Designs has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await chooseRoute(page, "Individual Designs");
    await uploadArtwork(page, png("a-very-long-individual-design-filename-that-must-wrap-without-breaking-the-layout.png"));
    await expectCombinedWorkspace(page);
    await configureFirstDesign(page, { method: "width", dimension: "10", quantity: "20" });
    await expect(page.getByTestId("gang-sheet-graphic")).toBeVisible();
    expect(await page.getByTestId("gang-sheet-graphic").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
  });
}
