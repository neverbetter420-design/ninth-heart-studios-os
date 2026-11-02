import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseMuseProjectPlan } from "../lib/muse-project-guide.ts";
import { reviewMuseChanges } from "../lib/muse-plan-review.ts";
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
check("single-revision fetch verifies current ledger integrity even for older snapshots",()=>{
  const fragment=route.split('const requested = payload.revision;')[1].split('if (action === "apply" || action === "save_revision")')[0];
  for(const token of [
    'Number(requested) > current.current_revision',
    '.eq("revision", Number(requested)).maybeSingle()',
    'if (!latest) return error("The current revision ledger is missing; restoration is blocked.", 409)',
    '.eq("revision", current.current_revision).maybeSingle()',
    'latest.revision !== current.current_revision',
    'parseMuseProjectPlan(latest.plan)',
    'JSON.stringify(latestPlan) !== JSON.stringify(currentPlan)',
    'parseMuseProjectPlan(entry.plan)',
    'current_revision: current.current_revision',
  ])assert.ok(fragment.includes(token),"Missing single-revision ledger integrity guard "+token);
  assert.ok(!fragment.includes('requested === current.current_revision &&'),
    "An older selected revision must not bypass the current ledger integrity check");
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
console.log(`Muse history source contracts: ${passed} passed, no hosted calls.`);
