import { expect, test as base, type Page } from "@playwright/test";

const test = base.extend<{ runtimeChecks: void }>({
  runtimeChecks: [async ({ page }, use) => {
  const consoleProblems: string[] = [];
  const failedRequests: string[] = [];
  const errorResponses: string[] = [];
  page.on("console", (message) => { if (message.type() === "error" || message.type() === "warning") consoleProblems.push(`${message.type()}: ${message.text()}`); });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText;
    if (reason !== "net::ERR_ABORTED") failedRequests.push(`${reason ?? "unknown error"}: ${request.url()}`);
  });
  page.on("response", (response) => { if (response.status() >= 400) errorResponses.push(`${response.status()} ${response.url()}`); });
  await use();
    expect(consoleProblems, "console errors or warnings").toEqual([]);
    expect(failedRequests, "failed requests").toEqual([]);
    expect(errorResponses, "HTTP error responses").toEqual([]);
  }, { auto: true }],
});

async function chooseRoute(page: Page, name: string) {
  await page.goto("/order/start");
  await page.getByLabel(new RegExp(name, "i")).check();
  await page.getByRole("button", { name: "Confirm starting point" }).click();
  await expect(page).toHaveURL(/\/order\/artwork$/);
}

async function acknowledgeArtwork(page: Page) {
  await page.getByRole("button", { name: "Acknowledge and continue" }).click();
  await expect(page).toHaveURL(/\/order\/configure$/);
}

test("homepage entry points enter and preselect the order prototype", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start a Print" }).first().click();
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.getByText(/no order will be created/i)).toBeVisible();

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

test("start over deliberately clears the in-memory draft", async ({ page }) => {
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
});

test("direct Review access redirects to the earliest incomplete step", async ({ page }) => {
  await page.goto("/order/review");
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do you want to start?");
});

test("full refresh clears working configuration and returns Configure to Start", async ({ page }) => {
  await chooseRoute(page, "Separate artwork");
  await acknowledgeArtwork(page);
  await page.getByLabel("Internal design label").fill("Unsaved browser memory");
  await page.reload();
  await expect(page).toHaveURL(/\/order\/start$/);
  await expect(page.locator('input[name="starting-route"]:checked')).toHaveCount(0);
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
