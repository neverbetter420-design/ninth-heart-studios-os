import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { build } from "esbuild";
import { previewCSS } from "../tests/helpers/nocturne-render.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(require.resolve("playwright", { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES] }))); }
const root = resolve(import.meta.dirname, "..");
const bundle = await build({
  absWorkingDir: root,
  stdin: { resolveDir: root, loader: "tsx", contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {MuseProjectGuide} from './components/projects/MuseProjectGuide.tsx';
const heartbeat={score:73,label:'Needs attention',open:4,blocked:1,overdue:1,pendingApprovals:1,
 oneMove:{id:'task-2',title:'Write the homepage promise',status:'not_started',priority:'high',due_at:null,parent_task_id:'task-1',estimated_minutes:30},
 reasons:['1 blocked task','1 overdue task','1 pending approval']};
createRoot(document.querySelector('#guide-root')).render(React.createElement(MuseProjectGuide,{projectId:'00000000-0000-4000-8000-000000000001',projectName:'Cedar & Stone Website',heartbeat,enabled:true}));` },
  bundle: true, write: false, platform: "browser", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "synthetic-next-navigation", setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "next/navigation", namespace: "synthetic" }));
    b.onLoad({ filter: /.*/, namespace: "synthetic" }, () => ({ loader: "js", contents: "export function useRouter(){return {refresh(){window.__refreshed=(window.__refreshed||0)+1}}}" }));
  } }],
});
const markup = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCSS}</style></head><body class="nhs-theme-admin"><main class="content-wrap studio-workspace studio-workspace-admin" style="padding:32px"><div id="guide-root"></div></main><script src="/guide.js"></script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/guide.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); }
  else { res.setHeader("Content-Type", "text/html"); res.end(markup); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const output = resolve(root, "nocturne-static-preview"); mkdirSync(output, { recursive: true });
const planId = "00000000-0000-4000-8000-000000000099";
const plan = {
  plan_id: planId, expires_at: "2099-10-30T20:00:00Z",
  summary: "Build the homepage strategy before decorating the void.",
  tasks: [{ title: "Define homepage strategy", description: "Set the conversion goal, promise and proof before layout work.",
    definition_of_done: "Goal, promise and proof are recorded.", priority: "high", due_date: null,
    estimated_minutes: 60, client_visible: true, subtasks: [{ title: "Write the homepage promise",
      description: "Create one concise promise aligned to the approved strategy.", definition_of_done: "One sentence is ready for design.",
      priority: "high", due_date: "2099-11-02", estimated_minutes: 30, client_visible: false }] }],
};
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const [name, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: "reduce" });
    const errors = []; const actions = []; let rejectReceipt = false;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await page.route("**/api/admin/muse-ai/project-plan", async route => {
      const body = route.request().postDataJSON(); actions.push(body.action);
      assert.equal(body.project_id, "00000000-0000-4000-8000-000000000001");
      if (body.action === "draft") {
        rejectReceipt = body.objective.includes("Receipt mismatch");
        const response = body.objective.includes("Malformed") ? { ...plan, plan_id: "not-a-uuid" }
          : body.objective.includes("Expired") ? { ...plan, expires_at: "2020-01-01T00:00:00Z" } : plan;
        await route.fulfill({ contentType: "application/json", body: JSON.stringify(response) });
      } else {
        assert.equal(body.plan_id, planId);
        await route.fulfill({ contentType: "application/json", body: JSON.stringify({
          plan_id: planId, created_count: rejectReceipt ? 1 : 2,
        }) });
      }
    });
    await page.goto(base);
    assert.equal(await page.getByText("Strategy with a pulse.").isVisible(), true);
    assert.equal(await page.getByText("Write the homepage promise", { exact: true }).first().isVisible(), true);
    await page.getByRole("button", { name: "Draft the project plan" }).click();
    await page.getByText("PROPOSED · NOTHING CREATED").waitFor();
    assert.deepEqual(actions, ["draft"]);
    assert.equal(await page.getByRole("button", { name: "Approve & create 2 tasks" }).isVisible(), true);
    assert.equal(await page.getByText("Visible to client", { exact: true }).count(), 1);
    assert.equal(await page.getByText("Studio-only", { exact: true }).count(), 1);
    assert.equal(await page.getByText("Due 2099-11-02").isVisible(), true);
    assert.equal(await page.getByText("One sentence is ready for design.", { exact: false }).isVisible(), true);
    assert.ok(await page.locator(".muse-project-guide").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "guide must not overflow horizontally");
    await page.screenshot({ path: resolve(output, `review-muse-project-guide-plan-${name}.png`), fullPage: true });
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Approve & create 2 tasks" }).click();
    await page.getByText("Created 2 approved tasks.").waitFor();
    assert.deepEqual(actions, ["draft", "apply"]);
    assert.equal(await page.evaluate(() => window.__refreshed), 1);
    for (const [objectiveText, errorText] of [
      ["Malformed response", "Muse returned an invalid or expired draft."],
      ["Expired response", "Muse returned an invalid or expired draft."],
    ]) {
      await page.locator("#muse-plan-objective").fill(objectiveText);
      await page.getByRole("button", { name: "Draft the project plan" }).click();
      await page.getByRole("alert").getByText(errorText, { exact: false }).waitFor();
      assert.equal(await page.getByRole("button", { name: /Approve & create/ }).count(), 0);
    }
    await page.locator("#muse-plan-objective").fill("Receipt mismatch response");
    await page.getByRole("button", { name: "Draft the project plan" }).click();
    await page.getByRole("button", { name: "Approve & create 2 tasks" }).waitFor();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Approve & create 2 tasks" }).click();
    await page.getByRole("alert").getByText("unexpected approval receipt", { exact: false }).waitFor();
    assert.equal(await page.getByText("Created 2 approved tasks.").count(), 0);
    assert.equal(await page.evaluate(() => window.__refreshed), 1);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: resolve(output, `review-muse-project-guide-applied-${name}.png`), fullPage: true });
    await page.close();
    console.log(`PASS Muse Project Guide approval flow: ${name}`);
  }
} finally {
  await browser.close(); await new Promise(done => server.close(done));
}
