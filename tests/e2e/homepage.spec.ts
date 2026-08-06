import { expect, test } from "./fixtures";

test("desktop homepage exposes the primary print journey", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DTF printing");
  await expect(page.getByRole("link", { name: "Start a Print" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("form, input[type='file'], a[href='#']")).toHaveCount(0);
  await expect(page.getByText("Start a Print to choose and securely upload files")).toBeVisible();
  await expect(page.getByText("Working upload controls are available from Start a Print")).toBeVisible();
  const headingLevels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
  expect(headingLevels.every((level, index) => index === 0 || level <= headingLevels[index - 1] + 1)).toBe(true);
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("mobile homepage has an operable navigation menu", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const menu = page.getByText("Menu", { exact: true });
  await menu.focus();
  await expect(menu).toHaveCSS("outline-style", "solid");
  await menu.press("Enter");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Process" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
});

test("reduced-motion preference keeps hero content immediately visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const heroContent = page.getByRole("heading", { level: 1 }).locator("..");
  await expect(heroContent).toHaveCSS("opacity", "1");
  await expect(heroContent).toHaveCSS("transform", "none");
});
