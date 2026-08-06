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
}
