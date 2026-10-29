import assert from "node:assert/strict";
import { validateMuseProjectPlan, readyTaskIds, type MuseProjectPlan } from "../lib/muse-project-guide.ts";
const mk=(id:string, dependsOn:string[]=[])=>({tempId:id,title:id,description:"Test",priority:"normal" as const,position:id==="a"?0:1,estimatedMinutes:30,completionCriteria:["Reviewed"],dependsOn,subtasks:[]});
const plan: MuseProjectPlan={schemaVersion:"1.0",projectId:"project-test",projectRevision:0,summary:"Fixture",warnings:[],phases:[{tempId:"phase-1",title:"Discovery",position:0,tasks:[mk("a"),mk("b",["a"])]}]};
assert.equal(validateMuseProjectPlan(plan).ok,true);
assert.deepEqual(readyTaskIds(plan,new Set()),["a"]);
assert.deepEqual(readyTaskIds(plan,new Set(["a"])),["b"]);
assert.equal(validateMuseProjectPlan({...plan,phases:[{...plan.phases[0],tasks:[mk("a",["b"]),mk("b",["a"])]}]}).ok,false);
assert.equal(validateMuseProjectPlan({...plan,phases:[{...plan.phases[0],tasks:[mk("a"),mk("b",["missing"])]}]}).ok,false);
assert.equal(validateMuseProjectPlan({...plan,phases:[{...plan.phases[0],tasks:[mk("a"),mk("a")]}]}).ok,false);
// The approved website-redesign example: 4 phases / 21 tasks.
const phaseNames = ["Discovery & Strategy", "Design Direction", "Website Development", "Testing & Launch"];
const phaseCounts = [4, 5, 7, 5];
let taskNumber = 0;
const fullPlan: MuseProjectPlan = {
  schemaVersion: "1.0",
  projectId: "p2",
  projectRevision: 2,
  summary: "Website redesign",
  warnings: [],
  phases: phaseCounts.map((count, phasePosition) => ({
    tempId: `phase-${phasePosition}`,
    title: phaseNames[phasePosition],
    position: phasePosition,
    tasks: Array.from({ length: count }, (_, position) => {
      const number = taskNumber++;
      return {
        tempId: `task-${number}`,
        title: `Task ${number + 1}`,
        description: "Project activity",
        priority: "normal" as const,
        position,
        estimatedMinutes: 30,
        completionCriteria: ["Complete and reviewed"],
        dependsOn: number ? [`task-${number - 1}`] : [],
        subtasks: [{
          tempId: `step-${number}`,
          title: "Checklist item",
          instructions: "Complete the step",
          position: 0,
          completionCriteria: ["Verified"],
        }],
      };
    }),
  })),
};
assert.equal(fullPlan.phases.length, 4);
assert.equal(fullPlan.phases.flatMap((p) => p.tasks).length, 21);
assert.equal(validateMuseProjectPlan(fullPlan).ok, true);
assert.deepEqual(readyTaskIds(fullPlan, new Set()), ["task-0"]);
assert.deepEqual(readyTaskIds(fullPlan, new Set(["task-0"])), ["task-1"]);
const invalidDuplicateSubtask = structuredClone(fullPlan);
invalidDuplicateSubtask.phases[0].tasks[0].subtasks.push({
  ...invalidDuplicateSubtask.phases[0].tasks[0].subtasks[0],
});
assert.equal(validateMuseProjectPlan(invalidDuplicateSubtask).ok, false);

console.log("verify:muse-project-guide — fixture assertions passed");
