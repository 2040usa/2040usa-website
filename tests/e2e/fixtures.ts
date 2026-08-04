import { test as base, expect, type BrowserContext, type Page, type Response } from "@playwright/test";

type ExpectedFailure = { method: string; path: string; status: number; responses: number; consoleDiagnostics: number };
export type RuntimeMonitor = {
  expectHttpFailure: (expected: Omit<ExpectedFailure, "responses" | "consoleDiagnostics">, trigger: () => Promise<unknown>) => Promise<Response>;
  assertClean: () => void;
};

export function monitorRuntime(page: Page): RuntimeMonitor {
  const consoleProblems: string[] = [];
  const failedRequests: string[] = [];
  const errorResponses: string[] = [];
  let active: ExpectedFailure | null = null;

  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const current = active;
    const isScopedDiagnostic = message.type() === "error" && current && message.text().includes(String(current.status));
    if (isScopedDiagnostic) {
      current.consoleDiagnostics += 1;
      if (current.consoleDiagnostics > 1) consoleProblems.push(`additional scoped diagnostic: ${message.text()}`);
      return;
    }
    consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText;
    if (reason !== "net::ERR_ABORTED") failedRequests.push(`${reason ?? "unknown error"}: ${request.method()} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    const current = active;
    const matches = current && response.request().method() === current.method && url.pathname === current.path && response.status() === current.status;
    if (matches) {
      current.responses += 1;
      if (current.responses > 1) errorResponses.push(`additional expected response: ${response.status()} ${response.request().method()} ${url.pathname}`);
      return;
    }
    errorResponses.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
  });

  return {
    expectHttpFailure: async (expected, trigger) => {
      if (active) throw new Error("An expected HTTP failure is already active.");
      active = { ...expected, responses: 0, consoleDiagnostics: 0 };
      try {
        const responsePromise = page.waitForResponse((response) => {
          const url = new URL(response.url());
          return response.request().method() === expected.method && url.pathname === expected.path && response.status() === expected.status;
        });
        const [response] = await Promise.all([responsePromise, trigger()]);
        await page.waitForTimeout(50);
        expect(active.responses, "exact expected HTTP response count").toBe(1);
        return response;
      } finally {
        active = null;
      }
    },
    assertClean: () => {
      expect(active, "no expected HTTP failure remains active").toBeNull();
      expect(consoleProblems, "console errors or warnings").toEqual([]);
      expect(failedRequests, "failed requests").toEqual([]);
      expect(errorResponses, "HTTP error responses").toEqual([]);
    },
  };
}

export const test = base.extend<{ runtimeMonitor: RuntimeMonitor }, { sharedContext: BrowserContext }>({
  sharedContext: [async ({ browser }, provide) => {
    const context = await browser.newContext();
    await provide(context);
    await context.close();
  }, { scope: "worker" }],
  page: async ({ sharedContext }, provide) => {
    const page = await sharedContext.newPage();
    await provide(page);
    await page.close();
  },
  runtimeMonitor: [async ({ page }, provide) => {
    const monitor = monitorRuntime(page);
    await provide(monitor);
    monitor.assertClean();
  }, { auto: true }],
});

export { expect };
