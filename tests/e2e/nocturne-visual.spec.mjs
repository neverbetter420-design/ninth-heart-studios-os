import { test, expect } from "@playwright/test";
import { previewCSS, renderNocturne } from "../helpers/nocturne-render.mjs";

// Actual page/shell markup, synthetic reads only. All network traffic is denied.
async function show(page, role, scenario = "normal", view = "home", section = "") {
  await page.route("**/*", (route) => route.abort());
  const { html } = await renderNocturne(role, scenario, view, section);
  await page.setContent(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`);
  await page.addStyleTag({ content: previewCSS });
}
async function contrast(locator, backgroundSelector) {
  return locator.evaluate((el, selector) => {
    const rgb = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (values) => values.map((n) => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const a = luminance(rgb(getComputedStyle(el).color));
    const b = luminance(rgb(getComputedStyle(selector ? el.closest(selector) : el).backgroundColor));
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, backgroundSelector);
}

test("Atelier dark sidebar retains readable identity and sign out", async ({ page }) => {
  await show(page, "client");
  // Reveal the same drawer for a CSS check without simulating authentication.
  await page.locator(".nhs-sidebar").evaluate((el) => el.classList.add("is-open"));
  expect(await contrast(page.locator(".brand-mark"), ".sidebar")).toBeGreaterThanOrEqual(4.5);
  const signOut = page.locator(".sidebar-bottom .sign-out-button");
  await signOut.scrollIntoViewIfNeeded();
  expect(await contrast(signOut)).toBeGreaterThanOrEqual(4.5);
  await signOut.hover();
  expect(await contrast(signOut)).toBeGreaterThanOrEqual(4.5);
  await signOut.focus();
  expect(await signOut.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  expect((await signOut.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

for (const role of ["client", "admin"]) {
  test(role + " project journey and open file workspace fit at narrow widths", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const scenario of ["normal", "long", "populated"]) {
      await show(page, role, scenario, "project", "files");
      await expect(page.getByRole("region", { name: "Project journey" })).toBeVisible();
      await expect(page.locator('.studio-journey li[aria-current="step"]')).toHaveCount(1);
      await expect(page.getByRole("navigation", { name: "Project destinations" })).toBeVisible();
      await expect(page.locator(role === "client" ? "details#project-resources" : "details#workspace-resources")).toHaveAttribute("open", "");
      await expect(page.locator(".studio-gallery img")).toHaveCount(scenario === "populated" ? 1 : 0);
      for (const width of [1440, 1024, 860, 620, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${role} ${scenario} project fits at ${width}px`).toBeLessThanOrEqual(width);
        for (const link of await page.getByRole("navigation", { name: "Project destinations" }).getByRole("link").all()) {
          await link.scrollIntoViewIfNeeded();
          await link.focus();
          expect(await link.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
        }
      }
    }
  });
}

test("Command Center progress and disclosure fit at desktop and narrow widths", async ({ page }) => {
  await show(page, "admin", "long");
  for (const width of [1440, 1280, 1024, 900, 860, 620, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = await page.locator(".project-panel").boundingBox();
    const percentage = await page.locator(".project-row b").boundingBox();
    expect(percentage.x + percentage.width, `100% fits inside Project Pulse at ${width}px`).toBeLessThanOrEqual(panel.x + panel.width - 10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const toggle = page.locator(".nocturne-insights-toggle");
    expect(await toggle.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const summary = page.locator(".nocturne-insights > summary");
    await summary.scrollIntoViewIfNeeded();
    await summary.click();
    await expect(page.locator(".nocturne-insights")).toHaveAttribute("open", "");
    await summary.press("Enter");
    await expect(page.locator(".nocturne-insights")).not.toHaveAttribute("open", "");
  }
  expect(await contrast(page.locator(".metric-card > span").first(), ".app-shell")).toBeGreaterThanOrEqual(4.5);
});

test("Atelier long titles, empty and error states fit at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const scenario of ["long", "empty", "error"]) {
    await show(page, "client", scenario);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.locator(".atelier-primary-link")).toBeVisible();
    if (scenario === "long") await expect(page.getByRole("link", { name: "Review approval" })).toBeVisible();
    if (scenario === "empty") await expect(page.getByRole("heading", { name: "Your story begins here." })).toBeVisible();
    if (scenario === "error") await expect(page.getByRole("alert")).toContainText("Projects are temporarily unavailable.");
  }
});

test("Nocturne priority surface keeps populated actions readable and reachable", async ({ page }) => {
  await show(page, "admin", "populated");
  await expect(page.locator(".action-row")).toHaveCount(3);
  for (const width of [1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await contrast(page.locator(".action-copy strong").first(), ".action-panel")).toBeGreaterThanOrEqual(4.5);
    const links = page.locator(".action-row a");
    for (const link of await links.all()) {
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport();
      await expect(link).toHaveAttribute("href", /\/leads\/synthetic-lead-/);
      await link.focus();
      expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
    }
  }
});
