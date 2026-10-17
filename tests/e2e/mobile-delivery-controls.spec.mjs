import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

// No app sign-in, network or Supabase access. Test the real mobile CSS against
// representative workspace markup and verify a physical pointer click works.
const root = fileURLToPath(new URL("../../", import.meta.url));
let css;

test.beforeAll(async () => {
  const parts = await Promise.all(
    ["app/globals.css", "app/phase4.css", "app/navigation.css"].map(
      (path) => readFile(resolve(root, path), "utf8"),
    ),
  );
  css = parts.join("\n");
});

test("project row actions remain clickable without mobile pointer interception", async ({ page, isMobile }) => {
  await page.setContent([
    '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>',
    '<div class="app-shell">',
    '<div class="navigation-shell"><header class="mobile-topbar"><button>Open navigation</button><span>NHS OS</span></header></div>',
    '<main class="main-shell"><div class="content-wrap"><div class="workspace-grid"><div class="workspace-span-12">',
    '<section class="panel" aria-label="Tasks"><ul class="delivery-list"><li class="delivery-row">',
    '<div class="delivery-row-main"><p class="delivery-row-title">NHS-WRITE-QA-very-long-name-that-should-wrap-on-mobile</p>',
    '<p class="delivery-row-sub">Task due date is pending</p></div>',
    '<span class="delivery-pill visible">Client sees this</span><span class="delivery-pill progress">In progress</span>',
    '<div class="delivery-actions">',
    '<form class="mini-form"><select aria-label="Task status"><option>In progress</option></select><button class="mini-button">Set</button></form>',
    '<form><button class="mini-button" aria-label="Hide QA task from client">👁</button></form>',
    '<form><button type="button" class="mini-button danger" aria-label="Delete QA task" onclick="document.querySelector(\'#result\').textContent=\'deleted\'">Delete</button></form>',
    '</div></li></ul></section></div></div><p id="result">not deleted</p></div></main></div></body></html>',
  ].join(""));
  await page.addStyleTag({ content: css });
  const action = page.getByRole("button", { name: "Delete QA task" });
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeInViewport();
  const rect = await action.boundingBox();
  const viewport = page.viewportSize();
  expect(rect).toBeTruthy();
  expect(viewport).toBeTruthy();
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
  if (isMobile) {
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  // Must be a real pointer click. Forcing clicks would conceal a broken layout.
  await action.click();
  await expect(page.locator("#result")).toHaveText("deleted");
});
