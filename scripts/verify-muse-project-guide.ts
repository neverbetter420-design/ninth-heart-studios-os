import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildProjectPlanRequest,
  calculateProjectHeartbeat,
  extractPlanFromResponse,
  parseMuseProjectPlan,
  type MuseProjectPlan,
} from "../lib/muse-project-guide.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
let passed = 0;
function check(name: string, task: () => void) { task(); passed++; console.log("PASS", name); }

const subtask = {
  title: "Write the homepage promise",
  description: "Create one concise promise aligned to the approved strategy.",
  definition_of_done: "One sentence is recorded and ready for design.",
  priority: "high" as const,
  due_date: "2026-11-02",
  estimated_minutes: 30,
  client_visible: false,
};
const valid: MuseProjectPlan = {
  summary: "Build the homepage strategy before decorating the void.",
  tasks: [{
    title: "Define homepage strategy",
    description: "Set the conversion goal, promise and proof before layout work.",
    definition_of_done: "Goal, promise and proof are recorded.",
    priority: "high",
    due_date: null,
    estimated_minutes: 60,
    client_visible: false,
    subtasks: [subtask],
  }],
};

check("bounded project plan parses without rewriting content", () => {
  assert.deepEqual(parseMuseProjectPlan(valid), valid);
  assert.deepEqual(extractPlanFromResponse({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(valid) }] }] }), valid);
});

check("malformed, empty, oversized and incomplete plans fail closed", () => {
  for (const value of [null, {}, { ...valid, tasks: [] }, { ...valid, tasks: Array(13).fill(valid.tasks[0]) },
    { ...valid, tasks: [{ ...valid.tasks[0], subtasks: Array(9).fill(subtask) }] },
    { ...valid, tasks: [{ ...valid.tasks[0], priority: "urgent" }] },
    { ...valid, tasks: [{ ...valid.tasks[0], due_date: "2026-02-31" }] }]) {
    assert.throws(() => parseMuseProjectPlan(value), /invalid_plan/);
  }
  assert.throws(() => extractPlanFromResponse({ status: "incomplete", output: [] }), /model_incomplete/);
});

check("structured provider request is storeless, strict and NHS bounded", () => {
  const request = buildProjectPlanRequest({ model: "gpt-6.1-sol", objective: "Plan homepage", now: "2026-10-29T20:00:00Z",
    project: { id: "project", name: "Synthetic" }, tasks: [], milestones: [], approvals: [] });
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(request.text.format.schema.additionalProperties, false);
  assert.match(request.instructions, /5–8 studio hours/);
  assert.match(request.instructions, /UNTRUSTED DATA/);
  assert.match(request.instructions, /Do not create outreach/);
});

check("Heartbeat is explainable and One Move prefers executable subtasks", () => {
  const heartbeat = calculateProjectHeartbeat([
    { id: "1", title: "Blocked parent", status: "blocked", priority: "high", due_at: "2026-10-20T00:00:00Z", parent_task_id: null, estimated_minutes: 60 },
    { id: "2", title: "Executable subtask", status: "not_started", priority: "high", due_at: "2026-10-30T00:00:00Z", parent_task_id: "3", estimated_minutes: 30 },
    { id: "3", title: "Normal parent", status: "not_started", priority: "normal", due_at: null, parent_task_id: null, estimated_minutes: null },
  ], 1, new Date("2026-10-29T20:00:00Z"));
  assert.equal(heartbeat.score, 73);
  assert.equal(heartbeat.label, "Needs attention");
  assert.equal(heartbeat.oneMove?.id, "2");
  assert.deepEqual(heartbeat.reasons, ["1 blocked task", "1 overdue task", "1 pending approval"]);
});

check("migration binds plans to owner, RLS and same-project one-level tasks", () => {
  const sql = read("supabase/migrations/20261029184832_muse_project_guide_v1.sql");
  for (const rule of [
    /alter table public\.muse_project_plans enable row level security/i,
    /created_by = \(select auth\.uid\(\)\)/i,
    /foreign key \(parent_task_id, project_id\)/i,
    /references public\.tasks\(id, project_id\)/i,
    /private\.enforce_muse_task_depth/i,
    /security invoker/i,
    /public\.apply_muse_project_plan/i,
    /for update/i,
    /status = 'draft'/i,
  ]) assert.match(sql, rule);
  assert.doesNotMatch(sql, /security definer/i);
});

check("plan route gates identity, origin, feature, spend and exact approval", () => {
  const route = read("app/api/admin/muse-ai/project-plan/route.ts");
  for (const token of ["getCurrentAuth", 'auth.profile.role !== "admin"', "origin !== new URL(request.url).origin",
    'MUSE_PROJECT_GUIDE_ENABLED !== "true"', "checkMuseRateLimit(auth.user.id)", 'action === "apply"',
    'db.rpc("apply_muse_project_plan"']) assert.ok(route.includes(token), "Missing route control: " + token);
  assert.ok(route.indexOf("checkMuseRateLimit(auth.user.id)") < route.indexOf('fetch("https://api.openai.com/v1/responses"'));
  assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_OPENAI/);
});

check("project UI requires a reviewed confirmation and keeps details collapsible", () => {
  const guide = read("components/projects/MuseProjectGuide.tsx");
  const tasks = read("components/projects/TaskSection.tsx");
  assert.match(guide, /PROPOSED · NOTHING CREATED/);
  assert.match(guide, /window\.confirm/);
  assert.match(guide, /Approve & create/);
  assert.match(tasks, /Guidance & definition of done/);
  assert.match(tasks, /Add subtask beneath/);
});

check("review rejects malformed or expired drafts and mismatched approval receipts", () => {
  const guide = read("components/projects/MuseProjectGuide.tsx");
  for (const token of [
    "validatedDraft(data)",
    "parseMuseProjectPlan(response)",
    "expires <= Date.now()",
    "Date.parse(plan.expires_at) <= Date.now()",
    "data.plan_id !== plan.plan_id || data.applied_revision !== plan.revision || data.created_count !== count",
    "if (!enabled || !plan || busy || editing) return",
    "clientVisibleCount(plan)",
    "subtask.definition_of_done",
    "subtask.client_visible",
    "task.due_date",
  ]) assert.ok(guide.includes(token), "Missing plan-review control: " + token);
  assert.doesNotMatch(guide, /data as unknown as DraftPlan|countCreated = typeof data\.created_count/);
});

console.log(`Muse Project Guide verification: ${passed} checks passed, zero hosted requests or business writes.`);
