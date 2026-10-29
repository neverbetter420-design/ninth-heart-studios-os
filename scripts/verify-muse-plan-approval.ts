import assert from "node:assert/strict";
import { preflightApplyPlan, canEditPlan, type PlanDraftApproval } from "../lib/muse-plan-approval.ts";
import type { MuseProjectPlan } from "../lib/muse-project-guide.ts";
const plan: MuseProjectPlan={schemaVersion:"1.0",projectId:"p1",projectRevision:3,summary:"Example",warnings:[],phases:[{tempId:"ph1",title:"Discovery",position:0,tasks:[{tempId:"t1",title:"Audit",description:"Inspect site",priority:"normal",position:0,estimatedMinutes:30,completionCriteria:["Audit saved"],dependsOn:[],subtasks:[]}]}]};
const draft: PlanDraftApproval={projectId:"p1",planVersion:2,projectRevision:3,status:"approved",approvedVersion:2,approvedDigest:"sha256:test",expiresAt:"2026-12-01T00:00:00Z"};
const base={plan,draft,authenticatedAdmin:true,currentProjectRevision:3,currentDigest:"sha256:test",nowIso:"2026-11-01T00:00:00Z"};
assert.deepEqual(preflightApplyPlan(base),{ok:true});
for(const input of [
 {...base,authenticatedAdmin:false},
 {...base,currentProjectRevision:4},
 {...base,currentDigest:"sha256:tampered"},
 {...base,draft:{...draft,approvedVersion:1}},
 {...base,draft:{...draft,status:"pending_approval" as const}},
 {...base,nowIso:"2026-12-02T00:00:00Z"},
 {...base,plan:{...plan,phases:[]}},
]) assert.equal(preflightApplyPlan(input).ok,false);
assert.equal(canEditPlan("approved"),false);
assert.equal(canEditPlan("draft"),true);
console.log("verify:muse-plan-approval — fixture assertions passed");
