import { parseMuseProjectPlan, type MusePlanSubtask, type MusePlanTask, type MuseProjectPlan } from "./muse-project-guide.ts";

/**
 * Pure, local-only plan editing contract for the next Project Guide milestone.
 * This does NOT save drafts, call an AI provider, or apply tasks. A future
 * versioned RPC must perform the same checks atomically against stored state.
 */
export type MusePlanSnapshot = Readonly<{
  plan_id: string;
  project_id: string;
  revision: number;
  plan: MuseProjectPlan;
}>;

export type MuseEditableField =
  | "title" | "description" | "definition_of_done" | "priority"
  | "due_date" | "estimated_minutes" | "client_visible";

export type MusePlanEdit =
  | { kind: "set-summary"; value: string }
  | { kind: "set-task-field"; task_index: number; field: MuseEditableField; value: unknown }
  | { kind: "set-subtask-field"; task_index: number; subtask_index: number; field: MuseEditableField; value: unknown }
  | { kind: "insert-task"; task_index: number; task: MusePlanTask }
  | { kind: "insert-subtask"; task_index: number; subtask_index: number; subtask: MusePlanSubtask }
  | { kind: "remove-task"; task_index: number }
  | { kind: "remove-subtask"; task_index: number; subtask_index: number };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const FIELDS = new Set<string>([
  "title", "description", "definition_of_done", "priority",
  "due_date", "estimated_minutes", "client_visible",
]);
const BASE_KEYS = [...FIELDS];
const MAX_REVISION = 25;

function fail(reason: string): never { throw new Error(reason); }
function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function exactKeys(v: unknown, keys: string[]) {
  if (!record(v) || Object.keys(v).some(key => !keys.includes(key)) ||
    keys.some(key => !Object.hasOwn(v, key))) fail("invalid_edit");
}
function index(value: unknown, size: number, allowEnd = false) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 ||
    Number(value) >= size + (allowEnd ? 1 : 0)) fail("invalid_index");
  return Number(value);
}
function checkSubtask(value: unknown) { exactKeys(value, BASE_KEYS); }
function checkTask(value: unknown) {
  exactKeys(value, [...BASE_KEYS, "subtasks"]);
  if (!record(value) || !Array.isArray(value.subtasks)) fail("invalid_edit");
  value.subtasks.forEach(checkSubtask);
}
function checkPlan(value: unknown) {
  exactKeys(value, ["summary", "tasks"]);
  if (!record(value) || !Array.isArray(value.tasks)) fail("invalid_edit");
  value.tasks.forEach(checkTask);
}
function checkField(field: string) {
  if (!FIELDS.has(field)) fail("invalid_edit");
}
function setField(target: MusePlanTask | MusePlanSubtask, field: string, value: unknown) {
  checkField(field);
  (target as unknown as Record<string, unknown>)[field] = value;
}

/** Bounded, immutable edit from an exact reviewed revision. Never persists. */
export function reviseMusePlan(
  snapshot: MusePlanSnapshot,
  expectedRevision: number,
  edit: MusePlanEdit,
): MusePlanSnapshot {
  if (!UUID.test(snapshot.plan_id) || !UUID.test(snapshot.project_id) ||
    !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1 ||
    snapshot.revision > MAX_REVISION) fail("invalid_snapshot");
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== snapshot.revision) fail("revision_conflict");
  if (snapshot.revision === MAX_REVISION) fail("revision_limit");
  checkPlan(snapshot.plan);
  const original = parseMuseProjectPlan(snapshot.plan);
  const updated = structuredClone(original);

  if (!record(edit)) fail("invalid_edit");
  switch (edit.kind) {
    case "set-summary":
      exactKeys(edit, ["kind", "value"]);
      updated.summary = edit.value;
      break;
    case "set-task-field":
      exactKeys(edit, ["kind", "task_index", "field", "value"]);
      setField(updated.tasks[index(edit.task_index, updated.tasks.length)], edit.field, edit.value);
      break;
    case "set-subtask-field": {
      exactKeys(edit, ["kind", "task_index", "subtask_index", "field", "value"]);
      const parent = updated.tasks[index(edit.task_index, updated.tasks.length)];
      setField(parent.subtasks[index(edit.subtask_index, parent.subtasks.length)], edit.field, edit.value);
      break;
    }
    case "insert-task":
      exactKeys(edit, ["kind", "task_index", "task"]);
      checkTask(edit.task);
      updated.tasks.splice(index(edit.task_index, updated.tasks.length, true), 0, structuredClone(edit.task));
      break;
    case "insert-subtask": {
      exactKeys(edit, ["kind", "task_index", "subtask_index", "subtask"]);
      checkSubtask(edit.subtask);
      const parent = updated.tasks[index(edit.task_index, updated.tasks.length)];
      parent.subtasks.splice(index(edit.subtask_index, parent.subtasks.length, true), 0, structuredClone(edit.subtask));
      break;
    }
    case "remove-task":
      exactKeys(edit, ["kind", "task_index"]);
      updated.tasks.splice(index(edit.task_index, updated.tasks.length), 1);
      break;
    case "remove-subtask": {
      exactKeys(edit, ["kind", "task_index", "subtask_index"]);
      const parent = updated.tasks[index(edit.task_index, updated.tasks.length)];
      parent.subtasks.splice(index(edit.subtask_index, parent.subtasks.length), 1);
      break;
    }
    default:
      fail("invalid_edit");
  }

  let clean: MuseProjectPlan;
  try {
    checkPlan(updated);
    clean = parseMuseProjectPlan(updated);
  } catch { return fail("invalid_plan"); }
  if (JSON.stringify(clean) === JSON.stringify(original)) fail("unchanged_plan");
  return { plan_id: snapshot.plan_id, project_id: snapshot.project_id,
    revision: snapshot.revision + 1, plan: clean };
}
