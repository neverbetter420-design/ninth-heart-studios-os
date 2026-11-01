import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
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
import React from "react"; import {createRoot} from "react-dom/client";
import {MuseProjectGuide} from "./components/projects/MuseProjectGuide.tsx";
const heartbeat={score:89,label:"Steady",open:1,blocked:0,overdue:0,pendingApprovals:0,
 oneMove:null,reasons:["No recorded blockers"]};
createRoot(document.querySelector("#root")).render(React.createElement(MuseProjectGuide,{
 projectId:"00000000-0000-4000-8000-000000000001",projectName:"Cedar and Stone",heartbeat,enabled:true
}));` },
  bundle: true, write: false, platform: "browser", define: { "process.env.NODE_ENV": '"production"' },
  plugins: [{ name: "synthetic-next-navigation", setup(b) {
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "next/navigation", namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
      loader: "js", contents: "export function useRouter(){return {refresh(){window.__refreshed=(window.__refreshed||0)+1}}}",
    }));
  } }],
});
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${previewCSS}</style></head><body class="nhs-theme-admin"><main class="content-wrap studio-workspace studio-workspace-admin" style="padding:22px">
<div id="root"></div></main><script src="/editor.js"></script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/editor.js") { res.setHeader("Content-Type", "application/javascript"); res.end(bundle.outputFiles[0].contents); }
  else { res.setHeader("Content-Type", "text/html"); res.end(html); }
});
await new Promise(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
const base = `http://127.0.0.1:${server.address().port}`;
const id = "00000000-0000-4000-8000-000000000099";
const project = "00000000-0000-4000-8000-000000000001";
const first = {
  plan_id: id, project_id: project, revision: 1, expires_at: "2099-12-30T23:59:59Z",
  summary: "Plan the small studio website.",
  tasks: [{title:"Map the home page",description:"Identify conversion goals and clear messages.",
    definition_of_done:"The home page map is approved.",priority:"high",due_date:null,
    estimated_minutes:60,client_visible:false,subtasks:[{
      title:"Write a headline",description:"Draft the principal site headline.",
      definition_of_done:"One concise headline has been reviewed.",priority:"normal",
      due_date:null,estimated_minutes:30,client_visible:false,
    }]}],
};
const browser=await chromium.launch({headless:true,
 ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
 ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),
});
try {
 for(const [name,width,height] of [["desktop",1280,900],["mobile",390,844]]) {
  const page=await browser.newPage({viewport:{width,height},reducedMotion:"reduce"});
  const errors=[];const actions=[];let saved=structuredClone(first);
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await page.route("**/api/admin/muse-ai/project-plan",async route=>{
    const body=route.request().postDataJSON();
    actions.push(body.action);
    assert.equal(body.project_id,project);
    if(body.action==="draft") {
      saved=structuredClone(first);
      await route.fulfill({contentType:"application/json",body:JSON.stringify(saved)});
    } else if(body.action==="load_latest") {
      await route.fulfill({contentType:"application/json",body:JSON.stringify(saved)});
    } else if(body.action==="save_revision") {
      assert.equal(body.plan_id,id);
      assert.equal(body.expected_revision,saved.revision);
      if(body.change_note.includes("STALE")) {
        await route.fulfill({status:409,contentType:"application/json",
          body:JSON.stringify({error:"Revision conflict. Reload the saved plan."})});
      } else {
        assert.equal(body.plan.tasks[0].client_visible,true);
        saved={...body.plan,plan_id:id,project_id:project,revision:saved.revision+1,expires_at:first.expires_at};
        await route.fulfill({contentType:"application/json",body:JSON.stringify(saved)});
      }
    } else if(body.action==="apply") {
      assert.equal(body.plan_id,id);
      assert.equal(body.expected_revision,2);
      assert.equal(body.expected_count,2);
      await route.fulfill({contentType:"application/json",
        body:JSON.stringify({plan_id:id,applied_revision:2,created_count:2})});
    } else throw Error("Unexpected Project Guide action: "+body.action);
  });
  await page.goto(base);
  await page.getByRole("button",{name:"Draft the project plan"}).click();
  await page.getByRole("button",{name:"Edit proposed tasks"}).waitFor();
  await page.getByRole("button",{name:"Edit proposed tasks"}).click();
  await page.locator(".muse-editor-task > summary").first().click();
  const title=page.locator("#muse-edit-0-parent-title");
  await title.fill("Map the booking-first homepage");
  await page.locator("#muse-edit-0-parent-visible").check();
  await page.getByText("1 additional item is marked client-visible.",{exact:false}).waitFor();
  await page.locator("#muse-edit-note").fill("Prioritize booking conversion and share review");
  const saveButton=page.getByRole("button",{name:/Save revision 2/});
  assert.equal(await saveButton.isDisabled(),true,"Must explicitly review before save");
  await page.getByRole("button",{name:"Mark these changes reviewed"}).click();
  assert.equal(await saveButton.isEnabled(),true);
  await title.fill("Map the booking and contact homepage");
  assert.equal(await saveButton.isDisabled(),true,"Changed text must invalidate prior review");
  await page.getByRole("button",{name:"Mark these changes reviewed"}).click();
  assert.equal(await page.getByText("Before:",{exact:false}).count()>0,true);
  page.once("dialog",dialog=>dialog.accept());
  await saveButton.click();
  await page.getByText("Saved revision 2. No project tasks were created.").waitFor();
  assert.equal(await page.getByText("Revision 2 · 2 total tasks").isVisible(),true);
  assert.equal(await page.getByText("Visible to client",{exact:true}).count(),1);
  assert.deepEqual(actions,["draft","save_revision"]);
  // Reopen from the server after closing the in-memory preview.
  await page.getByRole("button",{name:"Close preview"}).click();
  await page.getByRole("button",{name:"Reopen latest saved draft"}).click();
  await page.getByText("Revision 2 · 2 total tasks").waitFor();
  assert.deepEqual(actions,["draft","save_revision","load_latest"]);
  assert.ok(await page.locator(".muse-project-guide").evaluate(el=>el.scrollWidth<=el.clientWidth+1),
    "Editor must not overflow the container horizontally");
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Approve & create 2 tasks"}).click();
  await page.getByText("Created 2 approved tasks.").waitFor();
  assert.deepEqual(actions,["draft","save_revision","load_latest","apply"]);
  assert.equal(await page.evaluate(()=>window.__refreshed),1);
  // A rejected/indeterminate save must close approval until server reload.
  await page.getByRole("button",{name:"Draft the project plan"}).click();
  await page.getByRole("button",{name:"Edit proposed tasks"}).click();
  await page.locator("#muse-edit-summary").fill("Plan the updated client booking experience.");
  await page.locator("#muse-edit-note").fill("STALE revision conflict");
  await page.getByRole("button",{name:"Mark these changes reviewed"}).click();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:/Save revision 2/}).click();
  await page.getByRole("alert").getByText("Save was not confirmed.",{exact:false}).waitFor();
  assert.equal(await page.getByRole("button",{name:/Approve & create/}).count(),0);
  assert.deepEqual(errors,[],"No client JS errors");
  await page.close();
  console.log("PASS Muse versioned editor, exact review, reopen and fail-closed conflict: "+name);
 }
} finally {
 await browser.close();
 await new Promise(done=>server.close(done));
}
