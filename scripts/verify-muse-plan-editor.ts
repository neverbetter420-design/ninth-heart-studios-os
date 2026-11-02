import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reviewMuseChanges } from "../lib/muse-plan-review.ts";
import { parseMuseProjectPlan, type MuseProjectPlan } from "../lib/muse-project-guide.ts";

const original: MuseProjectPlan = {
 summary: "Plan the small studio website.",
 tasks: [{title:"Map the home page", description:"Identify message and conversion steps.",
 definition_of_done:"The content map has been approved.", priority:"high", due_date:null,
 estimated_minutes:60,client_visible:false,subtasks:[{
 title:"Write the headline",description:"Draft the first clear headline.",
 definition_of_done:"A reviewable headline is drafted.",priority:"normal",due_date:null,
 estimated_minutes:30,client_visible:false,
 }]}],
};
let passed=0;
function check(name:string, f:()=>void){f();passed++;console.log("PASS",name);}
check("unchanged proposal has no diff and no client exposure",()=>{
 const diff=reviewMuseChanges(original,original);
 assert.equal(diff.hasChanges,false); assert.equal(diff.changes.length,0);
 assert.equal(diff.newlyClientVisible,0);assert.equal(diff.oldTaskCount,2);
});
check("summary, visibility and deadline show before and after",()=>{
 const proposed=structuredClone(original);
 proposed.summary="Build a stronger restaurant website.";
 proposed.tasks[0].client_visible=true;proposed.tasks[0].subtasks[0].due_date="2026-12-01";
 const result=reviewMuseChanges(original,proposed);
 assert.equal(result.hasChanges,true);assert.equal(result.newlyClientVisible,1);
 assert.equal(result.oldVisible,0);assert.equal(result.newVisible,1);
 assert.ok(result.changes.some(c=>c.field==="Summary"&&c.before===original.summary&&c.after===proposed.summary));
 assert.ok(result.changes.some(c=>c.field.includes("Client visibility")&&c.after==="Visible to client"));
 assert.ok(result.changes.some(c=>c.field.includes("Due date")&&c.after==="2026-12-01"));
 assert.equal(original.tasks[0].client_visible,false);
});
check("added client-visible subtask triggers a clear warning",()=>{
 const proposed=structuredClone(original);
 proposed.tasks[0].subtasks.push({...proposed.tasks[0].subtasks[0],title:"Share a client preview",client_visible:true});
 const result=reviewMuseChanges(original,proposed);
 assert.equal(result.newlyClientVisible,1);assert.equal(result.newTaskCount,3);
 assert.ok(result.changes.some(c=>c.field.includes("step 2")));
});
check("removed step shows before/after task count, without mutating source",()=>{
 const proposed=structuredClone(original);proposed.tasks[0].subtasks=[];
 const result=reviewMuseChanges(original,proposed);
 assert.equal(result.newTaskCount,1);assert.equal(result.oldTaskCount,2);
 assert.equal(original.tasks[0].subtasks.length,1);
});
check("invalid plan never becomes an approvable diff",()=>{
 const invalid={...original,tasks:[{...original.tasks[0],estimated_minutes:2}]};
 assert.throws(()=>parseMuseProjectPlan(invalid),/invalid_plan/);
 assert.throws(()=>reviewMuseChanges(original,invalid),/invalid_plan/);
});
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
check("reopen remains owner scoped and does not consume AI",()=>{
 const route=read("app/api/admin/muse-ai/project-plan/route.ts");
 const load=route.indexOf('if (action === "load_latest")');
 const apply=route.indexOf('if (action === "apply" || action === "save_revision")');
 const model=route.indexOf('if ((process.env.MUSE_AI_PROVIDER || "openai") !== "openai")');
 assert.ok(load>0&&load<apply&&apply<model);
 for(const x of ['.eq("project_id", projectId)', '.eq("created_by", auth.user.id)', '.eq("status", "draft")',
  '.gt("expires_at", new Date().toISOString())','parseMuseProjectPlan(saved.plan)',
  'MUSE_PROJECT_GUIDE_ENABLED !== "true"']){
  assert.ok(route.includes(x),"Missing read permission check "+x);
 }
});
check("editor cannot save before reviewing the exact changed snapshot",()=>{
 const ui=read("components/projects/MusePlanEditor.tsx");
 const guide=read("components/projects/MuseProjectGuide.tsx");
 for(const x of ["reviewedSignature === signature","reviewMuseChanges(original, clean)","changeNote.trim().length >= 2",
  "newlyClientVisible","Mark these changes reviewed","Saving never creates tasks","Save revision"]){
  assert.ok(ui.includes(x),"Missing deliberate edit control "+x);
 }
 for(const x of ['action: "save_revision"','expected_revision: previous.revision','action: "load_latest"',
  'setPlan(null); setEditing(false)','data.revision !== previous.revision + 1']){
  assert.ok(guide.includes(x),"Missing revision UI control "+x);
 }
});
console.log("Muse editor: "+passed+" offline contract tests passed. No external requests.");
