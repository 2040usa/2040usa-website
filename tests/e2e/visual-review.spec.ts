import { type Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 360, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
] as const;

async function revealFullPage(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.75) {
      window.scrollTo(0, y);
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    window.scrollTo(0, 0);
  });
}

const visualDraftId = "00000000-0000-4000-8000-000000000101";
const visualArtworkId = "00000000-0000-4000-8000-000000000102";
const visualUpdatedAt = "2026-08-06T12:00:00.000Z";
const visualArtwork = {
  id: visualArtworkId, draftId: visualDraftId, route: "individual-designs", purpose: "individual-design", status: "uploaded",
  originalName: "a-very-long-individual-design-filename-for-responsive-review.png", extension: "png", mimeType: "image/png",
  declaredSizeBytes: 8, clientLastModified: 1, clientFingerprint: `fp1:${"a".repeat(64)}`, failureCode: null,
  attemptExpiresAt: "2026-08-07T12:00:00.000Z", uploadedAt: visualUpdatedAt, verifiedSizeBytes: 8,
  verifiedMimeType: "image/png", version: 2, replacementForId: null, createdAt: visualUpdatedAt, updatedAt: visualUpdatedAt,
};

async function mockIndividualDraft(page: Page, completed: boolean, includeOriginal = true) {
  const completedSizes = [{ id: "visual-size-width", method: "width", width: 11.5, quantity: 24 }, ...(includeOriginal ? [{ id: "visual-size-original", method: "original", quantity: 3 }] : [])];
  const workingSizes = [{ id: "visual-size-width", method: "width", dimension: "11.5", quantity: "24" }, ...(includeOriginal ? [{ id: "visual-size-original", method: "original", dimension: "", quantity: "3" }] : [])];
  const configuration = completed ? {
    route: "individual-designs", notes: "", designs: [{
      artworkId: visualArtworkId,
      sizes: completedSizes,
      wantsChanges: true, changeInstructions: "Remove the background and keep the fine outline.",
    }],
  } : null;
  const workingConfiguration = {
    route: "individual-designs", notes: "", designs: [{
      artworkId: visualArtworkId,
      sizes: workingSizes,
      wantsChanges: "yes", changeInstructions: "Remove the background and keep the fine outline.",
    }],
  };
  const draft = {
    id: visualDraftId, version: 4, status: "active", updatedAt: visualUpdatedAt, selectedRoute: "individual-designs",
    startingPointConfirmed: true, artworkAcknowledged: true, workingConfiguration, configuration, lastCompletedStep: completed ? 3 : 2,
  };
  const snapshot = { draft, artwork: [visualArtwork], readiness: { ready: true, uploadedCount: 1, activeCount: 1, totalDeclaredBytes: 8, totalVerifiedBytes: 8 } };
  await page.route("**/api/order-drafts/current", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ draft }) }));
  await page.route(`**/api/order-drafts/${visualDraftId}/artwork`, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }));
  await page.route(`**/api/order-drafts/${visualDraftId}/artwork/reconcile`, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }));
  await page.route(`**/api/artwork/${visualArtworkId}/preview-url`, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", expiresIn: 60 }) }));
  await page.route(`**/api/order-drafts/${visualDraftId}`, (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ draft: { ...draft, version: 5 } }) }));
}

async function mockArtworkWorkspace(page: Page, routeName: "individual-designs" | "gang-sheet", artwork: Array<typeof visualArtwork>, workingConfiguration: unknown) {
  const draft = {
    id: visualDraftId, version: 4, status: "active", updatedAt: visualUpdatedAt, selectedRoute: routeName,
    startingPointConfirmed: true, artworkAcknowledged: artwork.length > 0, workingConfiguration, configuration: null, lastCompletedStep: artwork.length > 0 ? 2 : 1,
  };
  const totalBytes = artwork.reduce((total, record) => total + record.declaredSizeBytes, 0);
  const snapshot = { draft, artwork, readiness: { ready: artwork.length > 0, uploadedCount: artwork.length, activeCount: artwork.length, totalDeclaredBytes: totalBytes, totalVerifiedBytes: totalBytes } };
  await page.route("**/api/order-drafts/current", (request) => request.fulfill({ contentType: "application/json", body: JSON.stringify({ draft }) }));
  await page.route(`**/api/order-drafts/${visualDraftId}/artwork`, (request) => request.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }));
  await page.route(`**/api/order-drafts/${visualDraftId}/artwork/reconcile`, (request) => request.fulfill({ contentType: "application/json", body: JSON.stringify(snapshot) }));
  await page.route("**/api/artwork/*/preview-url", (request) => request.fulfill({ contentType: "application/json", body: JSON.stringify({ url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", expiresIn: 60 }) }));
  await page.route(`**/api/order-drafts/${visualDraftId}`, (request) => request.fulfill({ contentType: "application/json", body: JSON.stringify({ draft: { ...draft, version: 5 } }) }));
}

for (const viewport of viewports) {
  test(`${viewport.name} visual audit has no runtime or overflow failures`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const errorResponses: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText;
      if (reason !== "net::ERR_ABORTED") failedRequests.push(`${reason ?? "unknown error"}: ${request.url()}`);
    });
    page.on("response", (response) => {
      if (response.status() >= 400) errorResponses.push(`${response.status()} ${response.url()}`);
    });

    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/", { waitUntil: "networkidle" });
    await revealFullPage(page);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(failedRequests, "failed network requests").toEqual([]);
    expect(errorResponses, "HTTP error responses").toEqual([]);

    await page.screenshot({
      fullPage: true,
      path: `artifacts/visual-review/home-${viewport.name}.png`,
    });
  });

  test(`${viewport.name} order start visual audit remains light and has no overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/order/start", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How do you want to start?");

    const presentation = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      colorScheme: window.getComputedStyle(document.documentElement).colorScheme,
    }));

    expect(presentation.scrollWidth, `order overflow at ${viewport.width}px`).toBeLessThanOrEqual(presentation.clientWidth);
    expect(presentation.colorScheme).toBe("light");
    await expect(page.locator("h1")).toHaveCount(1);

    await page.screenshot({
      fullPage: true,
      path: `artifacts/visual-review/order-start-${viewport.name}.png`,
    });
  });

  test(`${viewport.name} Artwork & Layout workspace stacks without overflow`, async ({ page }) => {
    await mockIndividualDraft(page, false, false);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/order/artwork");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Artwork & Layout");
    await expect(page.getByRole("group", { name: /a-very-long-individual-design-filename/ })).toBeVisible();
    await expect(page.getByTestId("gang-sheet-graphic")).toBeVisible();
    await expect(page.getByTestId("layout-preview")).toContainText("Most Cost Efficient");
    await expect(page.getByTestId("layout-options")).toHaveJSProperty("open", false);
    await expect(page.getByTestId("compact-artwork-uploader")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
    await page.screenshot({ fullPage: true, path: `artifacts/visual-review/artwork-layout-${viewport.name}.png` });
  });
}

test("desktop visual review captures the prominent empty artwork uploader", async ({ page }) => {
  await mockArtworkWorkspace(page, "individual-designs", [], { route: "individual-designs", designs: [], layoutPreferences: { mode: "efficient", spacingPreset: "standard", customSpacing: "" }, notes: "" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/order/artwork");
  await expect(page.getByRole("heading", { name: "Add artwork" })).toBeVisible();
  await expect(page.getByTestId("artwork-requirements")).toHaveJSProperty("open", false);
  await page.screenshot({ fullPage: true, path: "artifacts/visual-review/artwork-empty-desktop.png" });
});

test("desktop visual review captures expanded and grouped layout options", async ({ page }) => {
  await mockIndividualDraft(page, false, false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/order/artwork");
  const options = page.getByTestId("layout-options");
  await options.locator("summary").click();
  await expect(options).toHaveJSProperty("open", true);
  await page.screenshot({ fullPage: true, path: "artifacts/visual-review/layout-options-expanded-desktop.png" });
  await page.getByLabel("Keep Designs Together").check();
  await expect(page.getByTestId("gang-sheet-graphic").locator("svg")).toHaveAttribute("data-layout-mode", "grouped");
  await page.screenshot({ fullPage: true, path: "artifacts/visual-review/layout-grouped-desktop.png" });
});

test("desktop visual review captures multiple distinct artwork designs", async ({ page }) => {
  const secondArtwork = { ...visualArtwork, id: "00000000-0000-4000-8000-000000000103", originalName: "second-customer-design.png" };
  await mockArtworkWorkspace(page, "individual-designs", [visualArtwork, secondArtwork], {
    route: "individual-designs", layoutPreferences: { mode: "efficient", spacingPreset: "standard", customSpacing: "" }, notes: "",
    designs: [visualArtwork, secondArtwork].map((record, index) => ({ artworkId: record.id, sizes: [{ id: `visual-multiple-${index}`, method: "width", dimension: index ? "6" : "8", quantity: index ? "4" : "6" }], wantsChanges: "no", changeInstructions: "" })),
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/order/artwork");
  await expect(page.getByRole("group", { name: "second-customer-design.png" })).toBeVisible();
  await page.screenshot({ fullPage: true, path: "artifacts/visual-review/artwork-multiple-desktop.png" });
});

test("desktop visual review captures honest unresolved geometry", async ({ page }) => {
  await mockIndividualDraft(page, false, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/order/artwork");
  await expect(page.getByText("Could not generate the complete preview")).toBeVisible();
  await expect(page.getByTestId("layout-preview")).not.toContainText(/verified physical dimensions|Pixel dimensions/);
  await page.screenshot({ fullPage: true, path: "artifacts/visual-review/layout-unresolved-desktop.png" });
});

for (const count of [1, 2]) {
  test(`desktop visual review captures ${count} print-ready gang sheet${count === 1 ? "" : "s"}`, async ({ page }) => {
    const sheets = Array.from({ length: count }, (_, index) => ({ ...visualArtwork, id: `00000000-0000-4000-8000-00000000010${index + 2}`, route: "gang-sheet", purpose: "gang-sheet-file", originalName: index ? "second-ready-gang-sheet.png" : "customer-ready-gang-sheet.png" }));
    await mockArtworkWorkspace(page, "gang-sheet", sheets, { route: "gang-sheet", notes: "", sheets: sheets.map((record, index) => ({ artworkId: record.id, finishedWidth: "22", finishedLength: index ? "48" : "36", copies: index ? "2" : "1" })) });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/order/artwork");
    await expect(page.getByText("Add your gang sheets and tell us the finished size and copies.")).toBeVisible();
    await expect(page.getByTestId(/gang-sheet-preview-/)).toHaveCount(count);
    await expect(page.getByText("Layout options", { exact: true })).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: `artifacts/visual-review/print-ready-${count}-desktop.png` });
  });
}

test("Individual Designs Review renders artwork-linked variants without commercial claims", async ({ page }) => {
  await mockIndividualDraft(page, true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/order/review");
  await expect(page.getByRole("heading", { name: /a-very-long-individual-design-filename/ })).toBeVisible();
  await expect(page.getByText("Set by width: 11.5 in · quantity 24")).toBeVisible();
  await expect(page.getByText("Use original artwork size · quantity 3")).toBeVisible();
  await expect(page.getByText(/No order, price, payment, or production request exists/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ fullPage: true, path: "artifacts/visual-review/individual-review-desktop.png" });
});
