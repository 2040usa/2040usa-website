import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const png = (name: string) => ({ name, mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });

async function resetDraft(page: Page) {
  await page.goto("/order/start");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(async () => {
    const current = await fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()) as { draft: { id: string; version: number } | null };
    if (current.draft) await fetch(`/api/order-drafts/${current.draft.id}/reset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: current.draft.version }) });
  });
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
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 45_000 });
  for (const file of files) {
    await expect(page.getByRole("group", { name: file.name })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByAltText(`Private preview of ${file.name}; not a print approval`).first()).toBeVisible({ timeout: 15_000 });
  }
}

async function expectCombinedWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload and configure your artwork.");
  await expect(page.getByTestId("layout-preview")).toBeVisible();
}

async function configureFirstDesign(page: Page, options: { method?: "width" | "height" | "original"; dimension?: string; quantity?: string; changes?: string } = {}) {
  const method = options.method ?? "width";
  await page.getByLabel("Sizing method").first().selectOption(method);
  if (method !== "original") await page.getByLabel(method === "height" ? /Finished height/ : /Finished width/).first().fill(options.dimension ?? "11.5");
  await page.getByLabel("Quantity").first().fill(options.quantity ?? "24");
  if (options.changes) {
    await page.getByLabel("Yes, I need changes").first().check();
    await page.getByLabel("Requested changes").first().fill(options.changes);
  } else {
    await page.getByLabel("No, print it as uploaded").first().check();
  }
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
  await expect(page.getByText("Upload your arranged gang sheet", { exact: true })).toBeVisible();
  let current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { selectedRoute: string; startingPointConfirmed: boolean } };
  expect(current.draft).toMatchObject({ selectedRoute: "gang-sheet", startingPointConfirmed: true });

  await resetDraft(page);
  await chooseRoute(page, "Individual Designs");
  await expect(page.getByText("Upload each individual design", { exact: true })).toBeVisible();
  current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()));
  expect(current.draft).toMatchObject({ selectedRoute: "individual-designs", startingPointConfirmed: true });
});

test("legacy Project Details URL redirects to the canonical Artwork & Layout workspace", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await page.getByRole("button", { name: "Choose files" }).focus();
  await expect(page.getByRole("button", { name: "Choose files" })).toBeFocused();
  await page.getByRole("button", { name: "Drop files here or press Enter" }).focus();
  await expect(page.getByRole("button", { name: "Drop files here or press Enter" })).toBeFocused();
  await page.goto("/order/configure");
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upload and configure your artwork.");
  await expect(page.getByText("Project details", { exact: true })).toHaveCount(1);
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
  await expect(page.getByRole("button", { name: "Continue to Review" })).toBeDisabled();
  await page.unroute("**/api/order-drafts/*/artwork");
  await page.getByRole("button", { name: "Retry reservation for automatic-preview.png" }).click();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByAltText("Private preview of automatic-preview.png; not a print approval").first()).toBeVisible({ timeout: 15_000 });
  await expectCombinedWorkspace(page);
  expect(await page.evaluate(() => (window as typeof window & { __revokedArtworkPreviewUrls?: string[] }).__revokedArtworkPreviewUrls?.length ?? 0)).toBeGreaterThan(0);
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
  await page.getByLabel("No, print it as uploaded").nth(1).check();

  await expect(page.getByTestId("layout-preview")).toContainText("No optimized gang sheet has been generated.");
  await expect(page.getByTestId("layout-preview")).not.toContainText(/utilization|price|\d+(?:\.\d+)?\s*(?:in|inch|inches)\s+of sheet/i);
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

test("configuration validation protects sizing exclusivity and change instructions", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("validation.png"));
  await expectCombinedWorkspace(page);
  await page.getByRole("button", { name: "Continue to Review" }).click();
  await expect(page.getByLabel("Sizing method")).toBeFocused();
  await expect(page.locator('[id="designs.0.sizes.0-method-error"]')).toHaveText("Choose one sizing method.");
  await page.getByLabel("Sizing method").selectOption("original");
  await page.getByLabel("Quantity").fill("0");
  await page.getByLabel("Yes, I need changes").check();
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
  await page.getByLabel("No, print it as uploaded").nth(1).check();
  await page.getByRole("button", { name: "Remove delete-me.png" }).click();
  await expect(page.getByText("delete-me.png", { exact: true })).toHaveCount(0);
  await page.goto("/order/configure");
  await expect(page).toHaveURL(/\/order\/artwork$/);
  await expect(page.getByRole("group", { name: "keep-me.png" })).toBeVisible();
  await expect(page.getByRole("group", { name: "delete-me.png" })).toHaveCount(0);
});

test("replacement uses a new canonical record and preserves design details", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("old-design.png"));
  await expectCombinedWorkspace(page);
  await configureFirstDesign(page, { method: "height", dimension: "9", quantity: "12", changes: "Adjust the blue text." });
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
    await page.getByRole("button", { name: "Add another size" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
  });
}
