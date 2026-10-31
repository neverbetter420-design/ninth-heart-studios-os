import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { previewCSS, renderNocturne } from "../tests/helpers/nocturne-render.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES] }))); }
const root = resolve(import.meta.dirname, "..");
// The interactive QA fixture explicitly enables synthetic chat, independent of production flags.
const bundle = await build({ absWorkingDir: root, stdin: { resolveDir: root, contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MuseConcierge} from './components/MuseConcierge.tsx';
createRoot(document.querySelector('.nhs-muse-area')).render(React.createElement(MuseConcierge, { enabled: true }));`, loader: "tsx" },
  bundle: true, write: false, platform: "browser", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "synthetic-next", setup(b) {
    b.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: "synthetic" }));
    b.onLoad({ filter: /.*/, namespace: "synthetic" }, args => ({ loader: "js", resolveDir: root, contents: args.path === "next/link"
      ? "import React from 'react'; export default function Link(p){ return React.createElement('a',p,p.children); }"
      : "export function usePathname(){return window.fixturePage || '/muse'}" }));
  } }],
});
const { html } = await renderNocturne("admin", "populated", "home");
const markup = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCSS}</style></head><body>${html}<script src="/fixture.js"></script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/fixture.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); }
  else { res.setHeader("Content-Type", "text/html"); res.end(markup); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const output = resolve(root, "nocturne-static-preview"); mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const screenshots = [];
let count = 0;
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844], ["small-phone", 320, 640]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const errors = []; let requests = 0;
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.route("**/api/admin/muse-ai", async route => {
      requests++;
      const payload = route.request().postDataJSON();
      assert.ok(payload.question.length > 1); assert.ok(payload.history.every(m => ["user", "assistant"].includes(m.role)));
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        answer: "Start with Cedar & Stone’s reply. It is the highest saved attention item. Then review the homepage approval before planning the next build step.",
        sources: [{ label: "Cedar & Stone", href: "/leads/00000000-0000-4000-8000-000000000001" }],
        coverage: [{ area: "leads", reviewed: 3, available: 3, complete: true }, { area: "pending approvals", reviewed: 1, available: 1, complete: true }], partial: false,
      }) });
    });
    await page.goto(base); const launch = page.getByRole("button", { name: "Muse AI", exact: false }); await launch.click();
    const dialog = page.getByRole("dialog", { name: "Muse AI" }); await dialog.waitFor();
    assert.equal(await page.locator("#nhs-muse-question").evaluate(el => document.activeElement === el), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    await page.locator("#nhs-muse-question").fill("What needs attention today?"); await page.getByRole("button", { name: "Ask Muse", exact: true }).click();
    await page.getByText("Start with Cedar & Stone’s reply.", { exact: false }).waitFor();
    assert.equal(requests, 1); await page.getByText("Evidence checked for this answer").click();
    assert.equal(await page.getByText("leads: 3 records reviewed").isVisible(), true);
    assert.equal(await dialog.getByRole("link", { name: "Cedar & Stone", exact: false }).getAttribute("href"), "/leads/00000000-0000-4000-8000-000000000001");
    const box = await dialog.boundingBox(); assert.ok(box.x >= -1 && box.x + box.width <= width + 1, "drawer must fit viewport");
    assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), "drawer must not overflow horizontally");
    const shot = resolve(output, `review-muse-conversation-${name}.png`); await page.screenshot({ path: shot }); screenshots.push(shot);
    if (name === "desktop") {
      // Save a responsive HTML snapshot, not a browser screenshot. The real
      // component's fixture answer is visible, with all network/actions removed.
      const snapshot = (await page.content())
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<a\b([^>]*)>/gi, (_, attrs) => "<a" + attrs.replace(/\s(?:href|target)=(["']).*?\1/gi, "") + ' aria-disabled="true" tabindex="-1">')
        .replace(/<(button|textarea)\b([^>]*)>/gi, (_, tag, attrs) => "<" + tag + attrs + " disabled>")
        .replace(/<form\b[^>]*>/gi, '<form action="#" aria-disabled="true">')
        .replace(/<title>.*?<\/title>/i, "")
        .replace("<head>", '<head><title>NHS Muse AI — synthetic design preview</title><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; form-action \'none\'; base-uri \'none\'">')
        .replace("Read-only · Chat clears on reload · No automatic scans or messages", "Synthetic design preview · Example answer · No live connection");
      writeFileSync(resolve(output, "NHS_Muse_AI_Preview.html"), snapshot);
    }
    await page.getByRole("button", { name: "New chat" }).click();
    assert.equal(await page.getByText("What needs your attention?", { exact: true }).isVisible(), true);
    await page.keyboard.press("Escape"); assert.equal(await dialog.count(), 0);
    assert.equal(await launch.evaluate(el => document.activeElement === el), true); assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    // In-flight cancellation and reset must not leave a stuck composer.
    await page.unroute("**/api/admin/muse-ai");
    let release; const hold = new Promise(done => { release = done; });
    await page.route("**/api/admin/muse-ai", async route => { await hold; await route.fulfill({ contentType: "application/json", body: JSON.stringify({ answer: "Stale answer" }) }).catch(() => {}); });
    await launch.click(); await page.locator("#nhs-muse-question").fill("Review my tasks"); await page.getByRole("button", { name: "Ask Muse", exact: true }).click();
    await page.getByRole("button", { name: "Stop", exact: true }).click(); await page.getByRole("alert").waitFor();
    assert.equal(await page.locator("#nhs-muse-question").isEnabled(), true);
    await page.getByRole("button", { name: "New chat" }).click(); release();
    assert.equal(await page.getByText("Stale answer", { exact: true }).count(), 0);
    // Tab remains inside even after programmatic/background focus.
    await page.locator(".nhs-muse-shortcut").evaluate(el => el.focus()); await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    assert.deepEqual(errors, []); await page.close(); count++;
    console.log(`PASS interactive Muse drawer: ${name}, keyboard, answer, evidence, reset, cancel and geometry`);
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => { window.fixturePage = "/projects/00000000-0000-4000-8000-000000000001"; });
  await page.goto(base); await page.getByRole("button", { name: "Muse AI", exact: false }).click();
  assert.equal(await page.getByRole("button", { name: "What is this project's Heartbeat and One Move?", exact: false }).isVisible(), true);
  await page.close();
  console.log(`Muse browser QA passed: ${count} viewports plus project-context prompts. Synthetic records only.`);
} finally { await browser.close(); await new Promise(done => server.close(done)); }
