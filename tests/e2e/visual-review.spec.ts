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

async function mockIndividualDraft(page: Page, completed: boolean) {
  const configuration = completed ? {
    route: "individual-designs", notes: "", designs: [{
      artworkId: visualArtworkId,
      sizes: [{ id: "visual-size-width", method: "width", width: 11.5, quantity: 24 }, { id: "visual-size-original", method: "original", quantity: 3 }],
      wantsChanges: true, changeInstructions: "Remove the background and keep the fine outline.",
    }],
  } : null;
  const workingConfiguration = {
    route: "individual-designs", notes: "", designs: [{
      artworkId: visualArtworkId,
      sizes: [{ id: "visual-size-width", method: "width", dimension: "11.5", quantity: "24" }, { id: "visual-size-original", method: "original", dimension: "", quantity: "3" }],
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

  test(`${viewport.name} Individual Designs configuration stacks without overflow`, async ({ page }) => {
    await mockIndividualDraft(page, false);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/order/configure");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Configure each artwork file.");
    await expect(page.getByRole("group", { name: /a-very-long-individual-design-filename/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.locator("h1")).toHaveCount(1);
    await page.screenshot({ fullPage: true, path: `artifacts/visual-review/individual-configure-${viewport.name}.png` });
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
