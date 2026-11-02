import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMuseProjectPlan } from "../lib/muse-project-guide.ts";
import { reviewMuseChanges } from "../lib/muse-plan-review.ts";
import { assertMuseRevisionChain } from "../lib/muse-revision-chain.ts";
const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const route=read("app/api/admin/muse-ai/project-plan/route.ts");
const timeline=read("components/projects/MuseRevisionHistory.tsx");
const guide=read("components/projects/MuseProjectGuide.tsx");
const editor=read("components/projects/MusePlanEditor.tsx");
let passed=0;
const check=(name:string,f:()=>void)=>{f();++passed;console.log("PASS",name);};

check("owner-scoped history read requires exact active project and plan",()=>{
  for(const token of [
    'action === "load_history" || action === "load_revision"',
    '.eq("id", planId).eq("project_id", projectId).eq("created_by", auth.user.id)',
    '.eq("status", "draft")',
    'Date.parse(current.expires_at) <= Date.now()',
    '.eq("plan_id", planId).eq("created_by", auth.user.id)',
    "No active owner-owned draft",
    'MUSE_PROJECT_GUIDE_ENABLED !== "true"',
  ])assert.ok(route.includes(token),"Missing owner guard "+token);
});
check("history list excludes plan bodies and requires complete contiguous snapshots",()=>{
  const fragment=route.split('if (action === "load_history") {')[1].split('const requested = payload.revision')[0];
  for(const token of ['rows.length !== current.current_revision',
    'row.revision !== current.current_revision - index',
    'parseMuseProjectPlan(row.plan)',
    'JSON.stringify(latest) !== JSON.stringify(currentPlan)',
    'revisions: entries'])
    assert.ok(fragment.includes(token),"Missing ledger guard "+token);
  assert.ok(!fragment.includes('revisions: rows'),"Do not serialize entire history bodies");
});
check("direct history reads verify every contiguous snapshot before recovery",()=>{
  const fragment=route.split('const requested = payload.revision;')[1].split('if (action === "apply" || action === "save_revision")')[0];
  for(const token of [
    'Number(requested) > current.current_revision',
    '.eq("plan_id", planId).eq("created_by", auth.user.id)',
    '.order("revision", { ascending: false }).limit(25)',
    'history.length !== current.current_revision',
    'row.revision !== current.current_revision - index',
    'parseMuseProjectPlan(row.plan)',
    'JSON.stringify(verified[0].plan) !== JSON.stringify(currentPlan)',
    'verified.find(item => item.row.revision === requested)',
    'current_revision: current.current_revision',
  ])assert.ok(fragment.includes(token),"Missing complete direct-revision ledger guard "+token);
  assert.ok(!fragment.includes('requested === current.current_revision &&'),
    "Older snapshots must be denied when any ledger row is missing or inconsistent");
  assert.ok(!fragment.includes('.eq("revision", Number(requested)).maybeSingle()'),
    "A single-row query must not bypass complete history verification");
});
check("history UI checks ID, project, current revision, chronological index and task count",()=>{
  for(const token of [
    'response.plan_id !== planId',
    'response.project_id !== projectId',
    'response.current_revision !== revision',
    'response.revisions.length !== revision',
    'item.revision !== revision - index',
    'plan.summary !== entry.summary',
    'count !== entry.task_count',
    'visible !== entry.client_visible',
    'comparison.newlyClientVisible',
  ])assert.ok(timeline.includes(token),"Missing history receipt guard "+token);
});
check("restoration cannot overwrite history or silently approve",()=>{
  for(const token of [
    'selected.revision >= currentRevision',
    'onRestore(structuredClone(selected.plan), selected.revision)',
    'never overwrites the original',
    'reviewMuseChanges(currentPlan, selected.plan)',
    'currentRevision >= 25',
  ])assert.ok(timeline.includes(token),"Missing restoration safeguard "+token);
  assert.ok(!timeline.includes('action: "save_revision"'),"History component must not persist");
  assert.ok(!timeline.includes('action: "apply"'),"History component must never apply tasks");
});
check("editor treats historic snapshot as unsaved starting state and uses current CAS base",()=>{
  for(const token of [
    'initialDraft?: MuseProjectPlan',
    'structuredClone(initialDraft ?? original)',
    "reviewMuseChanges(original, clean)",
  ])assert.ok(editor.includes(token),"Missing editor recovery behavior "+token);
  for(const token of [
    'key={\`\${plan.plan_id}:\${plan.revision}:\${restoreSeed?.source ?? "current"}\`}',
    'expected_revision: previous.revision',
    'setRestoreSeed({ source, draft: snapshot })',
    'setEditing(true)',
  ])assert.ok(guide.includes(token.replaceAll("\\","")),"Missing recovery handoff "+token);
});
check("invalid recovered content cannot be compared or approved",()=>{
 const old={summary:"Initial small plan.",tasks:[{title:"Make a draft",description:"Write the first homepage draft.",definition_of_done:"Draft is ready.",priority:"normal" as const,due_date:null,estimated_minutes:25,client_visible:false,subtasks:[]}]};
 const modified=structuredClone(old);
 modified.tasks[0].description="Draft a mobile-first homepage.";
 assert.ok(reviewMuseChanges(parseMuseProjectPlan(old),parseMuseProjectPlan(modified)).hasChanges);
 assert.throws(()=>parseMuseProjectPlan({...old,tasks:[{...old.tasks[0],estimated_minutes:1}]}));
});

// This is exercised by verify:muse in the production-build CI workflow.
// Reopening a draft must check every snapshot, not merely the latest version.
const originalForChain=parseMuseProjectPlan({
 summary:"Original synthetic roadmap",tasks:[{
  title:"Design a private page",description:"Prepare the synthetic page.",
  definition_of_done:"Synthetic page is ready.",priority:"normal",
  due_date:null,estimated_minutes:30,client_visible:false,subtasks:[],
 }],
});
const secondForChain={...originalForChain,summary:"Updated synthetic roadmap"};
const thirdForChain={...originalForChain,summary:"Final synthetic roadmap"};
const goodChain=[
 {revision:3,plan:thirdForChain},
 {revision:2,plan:secondForChain},
 {revision:1,plan:originalForChain},
];
check("reopening accepts exactly three contiguous, parseable owner-fetched snapshots",()=>{
 assert.doesNotThrow(()=>assertMuseRevisionChain(goodChain,3,thirdForChain));
 assert.doesNotThrow(()=>assertMuseRevisionChain([{revision:1,plan:originalForChain}],1,originalForChain));
});
check("reopening rejects missing, duplicate, future and reordered revisions",()=>{
 const broken=[
  [goodChain[0],goodChain[2]],
  [goodChain[0],goodChain[1],goodChain[1]],
  [{revision:4,plan:thirdForChain},...goodChain],
  [goodChain[1],goodChain[0],goodChain[2]],
  [],
 ];
 for(const entries of broken) assert.throws(()=>assertMuseRevisionChain(entries,3,thirdForChain));
 assert.throws(()=>assertMuseRevisionChain(goodChain,26,thirdForChain));
});
check("reopening rejects mismatched latest or malformed historical content",()=>{
 assert.throws(()=>assertMuseRevisionChain(goodChain,3,secondForChain),/mismatch/);
 assert.throws(()=>assertMuseRevisionChain([
  goodChain[0],{revision:2,plan:{...secondForChain,tasks:[{
   ...secondForChain.tasks[0],estimated_minutes:1,
  }]}},goodChain[2],
 ],3,thirdForChain),/invalid_plan/);
});
check("load_latest owner-scopes and checks the full ledger before returning approvable draft",()=>{
 const fragment=route.split('if (action === "load_latest") {')[1]
   .split('if (action === "load_history" || action === "load_revision")')[0];
 for(const token of [
  '.eq("project_id", projectId).eq("created_by", auth.user.id).eq("status", "draft")',
  '.from("muse_project_plan_revisions")',
  '.eq("plan_id", saved.id).eq("created_by", auth.user.id)',
  '.order("revision", { ascending: false }).limit(25)',
  'assertMuseRevisionChain(history ?? [], saved.current_revision, clean)',
 ])assert.ok(fragment.includes(token),"Missing reopening ledger gate "+token);
 assert.ok(fragment.indexOf('assertMuseRevisionChain(')<fragment.indexOf('return NextResponse.json({'),
  "Reopening must verify the ledger before returning the saved draft");
});
console.log(`Muse history source contracts: ${passed} passed, no hosted calls.`);
