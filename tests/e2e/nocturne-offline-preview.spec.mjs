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
  await expect(page.locator("#preview")).toHaveCSS("width","390px");
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
