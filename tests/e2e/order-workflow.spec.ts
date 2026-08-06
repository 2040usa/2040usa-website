import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const png = (name: string) => ({ name, mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });

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
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await expect(page.getByText("Artwork ready for this draft")).toBeVisible({ timeout: 45_000 });
}

async function continueToConfiguration(page: Page) {
  await page.getByRole("button", { name: "Continue to project details" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
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
  const current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: null | { selectedRoute: string | null; startingPointConfirmed: boolean } };
  expect(current.draft === null || (current.draft.selectedRoute === null && current.draft.startingPointConfirmed === false)).toBe(true);
  await page.goto("/order/artwork");
  await expect(page).toHaveURL(/\/order\/start$/);
});

test("route-card activation durably establishes each route before navigation", async ({ page }) => {
  await chooseRoute(page, "Print-Ready Gang Sheet");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("arranged gang sheet");
  let current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json())) as { draft: { selectedRoute: string; startingPointConfirmed: boolean } };
  expect(current.draft).toMatchObject({ selectedRoute: "gang-sheet", startingPointConfirmed: true });

  await resetDraft(page);
  await chooseRoute(page, "Individual Designs");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("individual design");
  current = await page.evaluate(() => fetch("/api/order-drafts/current", { cache: "no-store" }).then((response) => response.json()));
  expect(current.draft).toMatchObject({ selectedRoute: "individual-designs", startingPointConfirmed: true });
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

test("Individual Designs links every upload to multiple size variants and requested changes", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("front-logo.png"), png("sleeve-mark.png"));
  await continueToConfiguration(page);
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

  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await expect(page.getByRole("heading", { name: "front-logo.png" })).toBeVisible();
  await expect(page.getByText("Set by width: 11.5 in · quantity 24")).toBeVisible();
  await expect(page.getByText("Set by height: 8 in · quantity 6")).toBeVisible();
  await expect(page.getByText("Use original artwork size · quantity 3")).toBeVisible();
  await expect(page.getByText("Remove the background and crop close.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "front-logo.png" })).toBeVisible();
  await expect(page.getByText(/price, payment, or production request/i)).toBeVisible();
});

test("configuration validation protects sizing exclusivity and change instructions", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("validation.png"));
  await continueToConfiguration(page);
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.locator('[id="designs.0.sizes.0-method-error"]')).toHaveText("Choose one sizing method.");
  await page.getByLabel("Sizing method").selectOption("original");
  await page.getByLabel("Quantity").fill("0");
  await page.getByLabel("Yes, I need changes").check();
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.locator('[id="designs.0.sizes.0-quantity-error"]')).toContainText("whole-number quantity");
  await expect(page.locator('[id="design-0-instructions-error"]')).toHaveText("Describe the changes you want us to review.");
});

test("deletion prunes its artwork-linked working configuration", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("delete-me.png"), png("keep-me.png"));
  await continueToConfiguration(page);
  await configureFirstDesign(page);
  await page.getByLabel("Sizing method").nth(1).selectOption("height");
  await page.getByLabel(/Finished height/).fill("5");
  await page.getByLabel("Quantity").nth(1).fill("7");
  await page.getByLabel("No, print it as uploaded").nth(1).check();
  await page.goto("/order/artwork");
  await page.getByRole("button", { name: "Remove delete-me.png" }).click();
  await expect(page.getByText("delete-me.png", { exact: true })).toHaveCount(0);
  await page.goto("/order/configure");
  await expect(page.getByRole("group", { name: "keep-me.png" })).toBeVisible();
  await expect(page.getByRole("group", { name: "delete-me.png" })).toHaveCount(0);
});

test("replacement uses a new canonical record and preserves design details", async ({ page }) => {
  await chooseRoute(page, "Individual Designs");
  await uploadArtwork(page, png("old-design.png"));
  await continueToConfiguration(page);
  await configureFirstDesign(page, { method: "height", dimension: "9", quantity: "12", changes: "Adjust the blue text." });
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/order\/review$/);
  await page.goto("/order/artwork");
  await page.getByRole("button", { name: "Replace old-design.png" }).click();
  await page.getByLabel("Choose artwork files").setInputFiles(png("new-design.png"));
  await page.getByRole("button", { name: "Upload selected files" }).click();
  await expect(page.getByText("new-design.png", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("old-design.png", { exact: true })).toHaveCount(0);
  await page.goto("/order/configure");
  await expect(page.getByRole("group", { name: "new-design.png" })).toBeVisible();
  await expect(page.getByLabel(/Finished height/)).toHaveValue("9");
  await expect(page.getByLabel("Quantity")).toHaveValue("12");
  await expect(page.getByLabel("Requested changes")).toHaveValue("Adjust the blue text.");
});

test("Print-Ready Gang Sheet configuration remains a draft-only path", async ({ page }) => {
  await chooseRoute(page, "Print-Ready Gang Sheet");
  await uploadArtwork(page, png("arranged-sheet.png"));
  await continueToConfiguration(page);
  await page.getByLabel("Number of sheets").fill("3");
  await page.getByLabel(/finished width/i).fill("22");
  await page.getByLabel(/finished length/i).fill("48");
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByText("22 in", { exact: true })).toBeVisible();
  await expect(page.getByText(/does not calculate a price, accept payment, or submit an order/i)).toBeVisible();
});

for (const width of [360, 768, 1440]) {
  test(`Individual Designs has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await chooseRoute(page, "Individual Designs");
    await uploadArtwork(page, png("a-very-long-individual-design-filename-that-must-wrap-without-breaking-the-layout.png"));
    await continueToConfiguration(page);
    await page.getByRole("button", { name: "Add another size" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
  });
}
