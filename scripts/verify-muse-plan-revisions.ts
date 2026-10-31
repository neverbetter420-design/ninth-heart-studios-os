import assert from "node:assert/strict";
import { reviseMusePlan, type MusePlanSnapshot } from "../lib/muse-plan-revisions.ts";
import type { MusePlanTask, MusePlanSubtask } from "../lib/muse-project-guide.ts";

const child: MusePlanSubtask = {
  title: "Write homepage promise", description: "Record a concise website promise.",
  definition_of_done: "The promise is approved for design.", priority: "high",
  due_date: null, estimated_minutes: 30, client_visible: false,
};
const parent: MusePlanTask = {
  title: "Define homepage strategy", description: "Align promise, proof and conversion goal.",
  definition_of_done: "A documented strategy is ready.", priority: "high",
  due_date: null, estimated_minutes: 60, client_visible: false, subtasks: [child],
};
const start: MusePlanSnapshot = {
  plan_id: "00000000-0000-4000-8000-000000000099",
  project_id: "00000000-0000-4000-8000-000000000001",
  revision: 1,
  plan: { summary: "A practical project plan.", tasks: [parent] },
};
let count = 0;
function check(name: string, task: () => void) {
  task(); count++; console.log("PASS", name);
}
function rejects(snapshot: MusePlanSnapshot, revision: number, edit: unknown, reason: string) {
  assert.throws(() => reviseMusePlan(snapshot, revision, edit as Parameters<typeof reviseMusePlan>[2]),
    e => e instanceof Error && e.message === reason);
}

check("exact matching revision creates an immutable, sequential snapshot", () => {
  const updated = reviseMusePlan(start, 1, { kind: "set-summary", value: "Plan the revised homepage." });
  assert.equal(updated.revision, 2);
  assert.equal(updated.plan.summary, "Plan the revised homepage.");
  assert.equal(start.revision, 1);
  assert.equal(start.plan.summary, "A practical project plan.");
  assert.equal(updated.plan_id, start.plan_id);
  assert.equal(updated.project_id, start.project_id);
});
check("explicit client-visible task edit preserves original", () => {
  const updated = reviseMusePlan(start, 1, {
    kind: "set-subtask-field", task_index: 0, subtask_index: 0, field: "client_visible", value: true,
  });
  assert.equal(updated.plan.tasks[0].subtasks[0].client_visible, true);
  assert.equal(start.plan.tasks[0].subtasks[0].client_visible, false);
});
check("valid per-task edits preserve the bounded schema", () => {
  const updated = reviseMusePlan(start, 1, {
    kind: "set-task-field", task_index: 0, field: "due_date", value: "2026-11-06",
  });
  assert.equal(updated.plan.tasks[0].due_date, "2026-11-06");
  rejects(start, 1, { kind: "set-task-field", task_index: 0, field: "estimated_minutes", value: 2 }, "invalid_plan");
  rejects(start, 1, { kind: "set-task-field", task_index: 0, field: "due_date", value: "2026-02-31" }, "invalid_plan");
});
check("task and subtask insertion keep exact shapes and bounds", () => {
  const added = reviseMusePlan(start, 1, { kind: "insert-task", task_index: 1, task: parent });
  assert.equal(added.plan.tasks.length, 2);
  const childAdded = reviseMusePlan(start, 1, {
    kind: "insert-subtask", task_index: 0, subtask_index: 1, subtask: child,
  });
  assert.equal(childAdded.plan.tasks[0].subtasks.length, 2);
  rejects(start, 1, { kind: "insert-subtask", task_index: 0, subtask_index: 1,
    subtask: { ...child, subtasks: [] } }, "invalid_edit");
});
check("removal does not allow an empty proposal", () => {
  rejects(start, 1, { kind: "remove-task", task_index: 0 }, "invalid_plan");
  const edited = reviseMusePlan(start, 1, { kind: "remove-subtask", task_index: 0, subtask_index: 0 });
  assert.equal(edited.plan.tasks[0].subtasks.length, 0);
});
check("stale revision, negative indices and no-op cannot be saved", () => {
  rejects(start, 0, { kind: "set-summary", value: "Another summary." }, "revision_conflict");
  rejects(start, 2, { kind: "set-summary", value: "Another summary." }, "revision_conflict");
  rejects(start, 1, { kind: "remove-subtask", task_index: -1, subtask_index: 0 }, "invalid_index");
  rejects(start, 1, { kind: "remove-task", task_index: 0.5 }, "invalid_index");
  rejects(start, 1, { kind: "set-summary", value: start.plan.summary }, "unchanged_plan");
});
check("unknown edit fields, extra input fields and invalid identities fail", () => {
  rejects(start, 1, { kind: "set-task-field", task_index: 0, field: "status", value: "complete" }, "invalid_edit");
  rejects(start, 1, { kind: "set-summary", value: "Allowed summary", send_email: true }, "invalid_edit");
  rejects({ ...start, plan_id: "not-uuid" }, 1, { kind: "set-summary", value: "Allowed summary" }, "invalid_snapshot");
});
check("bounded parent, subtask, total task, and revision caps enforce v1 constraints", () => {
  const parents12 = { ...start, plan: { ...start.plan, tasks: Array.from({ length: 12 }, () => parent) } };
  rejects(parents12, 1, { kind: "insert-task", task_index: 12, task: parent }, "invalid_plan");
  const children8 = { ...start, plan: { ...start.plan, tasks: [{ ...parent, subtasks: Array(8).fill(child) }] } };
  rejects(children8, 1, { kind: "insert-subtask", task_index: 0, subtask_index: 8, subtask: child }, "invalid_plan");
  const full48 = { ...start, plan: { ...start.plan, tasks: Array.from({ length: 12 }, () => ({ ...parent, subtasks: Array(3).fill(child) })) } };
  rejects(full48, 1, { kind: "insert-subtask", task_index: 0, subtask_index: 3, subtask: child }, "invalid_plan");
  rejects({ ...start, revision: 25 }, 25, { kind: "set-summary", value: "Change again." }, "revision_limit");
});
console.log("Muse plan revision contract:", count, "pure local checks passed. No API requests, database writes, or provider activation.");
