import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Exercise file:// directly: previous web-served checks could not detect the blank local preview.
test.beforeAll(() => {
  if (!existsSync(resolve("nocturne-static-preview/index.html"))) {
    execFileSync(process.execPath, ["scripts/build-nocturne-static.mjs"], { cwd: process.cwd(), timeout: 120_000 });
  }
});

test("self-contained offline preview renders Admin and Client without external requests", async ({ page }) => {
  test.setTimeout(90_000);
  const outbound = [];
  page.on("request", request => {
    if (/^https?:/.test(request.url())) outbound.push(request.url());
  });
  await page.goto(pathToFileURL(resolve("nocturne-static-preview/index.html")).href);
  const frame = page.frameLocator("#preview");
  await expect(frame.locator(".app-shell")).toBeVisible();
  await expect(frame.locator(".nhs-theme-admin")).toHaveCount(1);
  await expect(page.locator("#preview")).toHaveAttribute("sandbox", "");
  await page.locator("#role").selectOption("client");
  await expect(frame.locator(".nhs-theme-client")).toBeVisible();
  await expect(frame.locator(".atelier-home")).toBeVisible();
  await page.locator("#view").selectOption("project");
  await expect(frame.locator(".studio-workspace")).toBeVisible();
  await page.locator("#width").selectOption("mobile");
  const doc = await page.locator("#preview").getAttribute("srcdoc");
  expect(doc).toContain("studio-workspace");
  expect(doc).not.toContain('href="../../visual.css"');
  expect(outbound).toEqual([]);
});
