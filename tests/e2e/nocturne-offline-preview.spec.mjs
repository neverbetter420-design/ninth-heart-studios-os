import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

test.beforeAll(() => {
  execFileSync(process.execPath, ["scripts/build-nocturne-static.mjs"], { cwd: process.cwd(), timeout: 120_000 });
});

test("extracted offline preview always renders Admin and switches to warm Client without frames", async ({page,browser}) => {
  test.setTimeout(90_000);
  const errors=[], external=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("request",req=>{if(/^https?:/.test(req.url()))external.push(req.url());});
  const url=pathToFileURL(resolve("nocturne-static-preview/index.html")).href;
  await page.goto(url);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("#preview .app-shell.nhs-theme-admin")).toBeVisible();
  await expect(page.locator("#preview")).toContainText("Command Center");
  await page.locator("#role").selectOption("client");
  await expect(page.locator("#preview .app-shell.nhs-theme-client")).toBeVisible();
  await expect(page.locator("#preview .atelier-home")).toBeVisible();
  await page.locator("#role").selectOption("admin");
  await page.locator("#view").selectOption("client-detail");
  const surface=page.locator("#preview .management-client-grid");
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS("background-color","rgb(249, 244, 238)");
  await expect(page.locator("#preview")).toContainText("Cedar & Stone");
  await page.locator("#width").selectOption("mobile");
  const previewWidth = await page.locator("#preview").evaluate(el => el.getBoundingClientRect().width);
  const availableWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(previewWidth).toBeGreaterThan(320);
  expect(previewWidth).toBeLessThanOrEqual(Math.min(390, availableWidth));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(availableWidth);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  const noJS=await browser.newContext({javaScriptEnabled:false});
  try {
    const local=await noJS.newPage();
    await local.goto(url);
    await expect(local.locator("#preview .app-shell.nhs-theme-admin")).toBeVisible();
    await expect(local.locator("#preview")).toContainText("Command Center");
  } finally { await noJS.close(); }
});


test("seven approved rooms render distinctly and fit desktop/mobile with no outbound requests", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors = [], outbound = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/i.test(request.url())) outbound.push(request.url());
  });
  await page.goto(pathToFileURL(resolve("nocturne-static-preview/seven-rooms.html")).href);
  const rooms = ["observatory", "electric", "rose", "artist", "archive", "velvet", "private"];
  await expect(page.locator('[aria-label="Seven distinct NHS room previews"] [data-room-card]')).toHaveCount(rooms.length);
  for (const room of rooms) {
    const card = page.locator('[data-room-card="' + room + '"]');
    await expect(card).toHaveCount(1);
    await expect(card.locator('.nhs-room-identity[data-room="' + room + '"]')).toHaveCount(1);
    await expect(card.locator(":scope > header > h2")).not.toBeEmpty();
  }
  await expect(page.locator('[data-room-card="archive"]')).toContainText("Private Archive");
  await expect(page.locator('[data-room-card="private"]')).toContainText("Private Atelier");
  for (const [width, height, label] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
    await page.setViewportSize({width, height});
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, label + " horizontal overflow").toBeLessThanOrEqual(1);
    await page.screenshot({
      path: resolve("nocturne-static-preview/review-seven-rooms-" + label + "-" + testInfo.project.name + ".png"),
      fullPage: true,
      animations: "disabled",
    });
  }
  expect(errors).toEqual([]);
  expect(outbound).toEqual([]);
});


test("scanner glass workspace separates tasks without exposing data or triggering actions", async ({page}) => {
  test.setTimeout(90_000);
  const errors = [], external = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/^https?:/i.test(request.url())) external.push(request.url());
  });
  await page.goto(pathToFileURL(resolve("nocturne-static-preview/index.html")).href);
  await page.locator("#role").selectOption("admin");
  const samples = [
    ["scanner", "Scan studio.", ".scanner-controls", "scan"],
    ["scanner-best", "Best fits.", ".scanner-challenger-board", "best"],
    ["scanner-prospects", "Saved prospects.", ".scanner-glass-prospects", "prospects"],
    ["scanner-insights", "Insights.", ".scanner-glass-insights", "insights"],
  ];
  for (const [view, heading, target, selected] of samples) {
    await page.locator("#view").selectOption(view);
    const preview = page.locator("#preview");
    await expect(preview.locator(".scanner-glass-header h2")).toHaveText(heading);
    await expect(preview.locator(".scanner-glass-nav .scanner-glass-tab")).toHaveCount(4);
    await expect(preview.locator(target)).toHaveCount(1);
    await expect(preview.locator('.scanner-glass-tab[aria-current="page"]')).toHaveCount(1);
    // Offline previews deliberately disable navigation actions; switching is
    // exercised with the synthetic gallery selector instead of real links.
    await expect(preview.locator('.scanner-glass-tab[aria-current="page"]')).toHaveAttribute("aria-disabled", "true");
    if (selected !== "scan") await expect(preview.locator(".scanner-controls")).toHaveCount(0);
    if (selected !== "best") await expect(preview.locator(".scanner-challenger-board")).toHaveCount(0);
    if (selected !== "prospects") await expect(preview.locator(".scanner-glass-prospects")).toHaveCount(0);
    if (selected !== "insights") await expect(preview.locator(".scanner-glass-insights")).toHaveCount(0);
  }
  await page.locator("#view").selectOption("scanner");
  await page.locator("#width").selectOption("mobile");
  await expect(page.locator("#preview .scanner-glass-nav")).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
