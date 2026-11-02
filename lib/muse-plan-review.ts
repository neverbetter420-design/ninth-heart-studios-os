import { parseMuseProjectPlan, type MusePlanTask, type MusePlanSubtask, type MuseProjectPlan } from "./muse-project-guide.ts";

export type MuseChange = { field: string; before: string; after: string };
export type MuseReviewDiff = {
  changes: MuseChange[];
  newlyClientVisible: number;
  oldVisible: number;
  newVisible: number;
  oldTaskCount: number;
  newTaskCount: number;
  hasChanges: boolean;
};

const labelByField: Record<string, string> = {
  title: "Title", description: "Description", definition_of_done: "Definition of done",
  priority: "Priority", due_date: "Due date", estimated_minutes: "Estimate",
  client_visible: "Client visibility",
};
const fields = Object.keys(labelByField) as (keyof MusePlanSubtask)[];
const textValue = (v: string | number | boolean | null) =>
  v === null ? "Not set" : typeof v === "boolean" ? (v ? "Visible to client" : "Studio-only") : String(v);
const countTasks = (plan: MuseProjectPlan) =>
  plan.tasks.reduce((total, task) => total + 1 + task.subtasks.length, 0);
const countVisible = (plan: MuseProjectPlan) =>
  plan.tasks.reduce((total, task) => total + Number(task.client_visible)
    + task.subtasks.filter(child => child.client_visible).length, 0);

/** Pure, bounded human-readable review. This cannot persist or apply a plan. */
export function reviewMuseChanges(original: MuseProjectPlan, candidate: MuseProjectPlan): MuseReviewDiff {
  const before = parseMuseProjectPlan(original), after = parseMuseProjectPlan(candidate);
  const changes: MuseChange[] = [];
  let newlyClientVisible = 0;
  function note(field: string, from: string, to: string) {
    if (from !== to) changes.push({ field, before: from, after: to });
  }
  function compareTask(oldTask: MusePlanTask | MusePlanSubtask | undefined,
    nextTask: MusePlanTask | MusePlanSubtask | undefined, name: string) {
    if (!oldTask && nextTask) {
      note(name, "Not in prior revision", nextTask.title);
      if (nextTask.client_visible) newlyClientVisible++;
      return;
    }
    if (oldTask && !nextTask) {
      note(name, oldTask.title, "Removed from proposal");
      return;
    }
    if (!oldTask || !nextTask) return;
    for (const field of fields) {
      const oldValue = oldTask[field], nextValue = nextTask[field];
      note(name + " · " + labelByField[field], textValue(oldValue), textValue(nextValue));
    }
    if (!oldTask.client_visible && nextTask.client_visible) newlyClientVisible++;
  }
  note("Summary", before.summary, after.summary);
  for (let i = 0; i < Math.max(before.tasks.length, after.tasks.length); i++) {
    const prior = before.tasks[i], proposed = after.tasks[i];
    compareTask(prior, proposed, "Task " + (i + 1));
    if (!prior || !proposed) {
      if (proposed) for (const child of proposed.subtasks) if (child.client_visible) newlyClientVisible++;
      continue;
    }
    for (let j = 0; j < Math.max(prior.subtasks.length, proposed.subtasks.length); j++) {
      compareTask(prior.subtasks[j], proposed.subtasks[j], "Task " + (i + 1) + " · step " + (j + 1));
    }
  }
  return {
    changes,
    newlyClientVisible,
    oldVisible: countVisible(before),
    newVisible: countVisible(after),
    oldTaskCount: countTasks(before),
    newTaskCount: countTasks(after),
    hasChanges: changes.length > 0,
  };
}
