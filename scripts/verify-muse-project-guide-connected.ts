import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildMuseProjectPlan, parseMuseProjectPlan, projectGuideEnabled } from "../lib/muse-project-guide-runtime.ts";
import { validateMuseProjectPlan } from "../lib/muse-project-guide.ts";

assert.equal(projectGuideEnabled(), false, "PG-04 must default OFF in CI and ordinary production");
const project = {id:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",name:"Cedar & Stone",muse_revision:8};
const plan = buildMuseProjectPlan(project);
assert.equal(plan.projectId,project.id);
assert.equal(plan.projectRevision,8);
assert.match(plan.summary,/Cedar & Stone/);
assert.deepEqual(plan.phases.map(p=>p.tasks.length),[4,5,7,5]);
assert.equal(validateMuseProjectPlan(plan).ok,true);
assert.ok(parseMuseProjectPlan(plan));
assert.equal(parseMuseProjectPlan({...plan,projectId:""}),null);
assert.equal(parseMuseProjectPlan({...plan,phases:[{...plan.phases[0],tasks:[]}, ...plan.phases.slice(1)]})?.phases[0].tasks.length,0);
assert.equal(parseMuseProjectPlan({...plan,phases:[]}),null);
assert.equal(parseMuseProjectPlan(null),null);
assert.equal(parseMuseProjectPlan({...plan,phases: new Array(13).fill(plan.phases[0])}),null);
assert.throws(()=>buildMuseProjectPlan({...project,id:"not-a-uuid"}));

const page=readFileSync("app/(protected)/(admin)/muse/project-guide/page.tsx","utf8");
const actions=readFileSync("app/(protected)/(admin)/muse/project-guide/actions.ts","utf8");
const ui=readFileSync("components/muse/MuseProjectGuideConnected.tsx","utf8");
const sql=readFileSync("supabase/proposals/muse-project-guide/20261029052000_muse_plan_apply.sql","utf8");

assert.match(page,/await requireAdmin\(\)/);
assert.match(page,/if \(!enabled \|\| params.mode !== "connected"\)/,
  "Off-by-default must render read-only synthetic mode without reading proposed tables");
assert.match(page,/parseMuseProjectPlan/);
assert.match(page,/muse_review_project_plan/);
assert.match(actions,/await requireAdmin\(\)/);
assert.match(actions,/if \(!projectGuideEnabled\(\)\)/);
for (const fn of ["createMuseProjectDraft","renameMuseDraftTask","submitMuseProjectDraft",
  "approveMuseProjectDraft","applyMuseProjectDraft","rejectMuseProjectDraft"]) {
  assert.match(actions,new RegExp("export async function "+fn+"\\("));
}
for(const rpc of ["muse_create_project_plan","muse_edit_project_plan","muse_submit_project_plan",
 "muse_review_project_plan","muse_approve_project_plan","muse_apply_project_plan","muse_reject_project_plan"])
 assert.ok(actions.includes(rpc),"Missing secured RPC action "+rpc);
assert.match(actions,/confirm_review/);
assert.match(actions,/confirm_apply/);
assert.match(ui,/Full Change Preview/i);
assert.match(ui,/Approve plan v/);
assert.match(ui,/Apply approved plan/);
assert.match(ui,/Open project workspace/);
assert.match(sql,/if not private\.is_admin\(\)/);
assert.match(sql,/for update/);
assert.match(sql,/status='applied'/);
assert.doesNotMatch(actions,/sendEmail|runScan|cf:deploy|fetch\(/);
console.log("verify:muse-project-guide-connected — default-off gating, real-project template, approval boundary, UI and actions verified.");
