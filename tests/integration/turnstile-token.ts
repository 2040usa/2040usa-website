import { createServer } from "node:http";
import { chromium } from "@playwright/test";

export async function acquireTurnstileToken(siteKey: string) {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><body><div class="cf-turnstile" data-sitekey="${siteKey}"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start the loopback Turnstile harness.");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}`);
    const tokenControl = page.locator('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
    await tokenControl.waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForFunction(() => {
      const control = document.querySelector<HTMLInputElement | HTMLTextAreaElement>('[name="cf-turnstile-response"]');
      return Boolean(control?.value);
    }, undefined, { timeout: 30_000 });
    return await tokenControl.inputValue();
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}
