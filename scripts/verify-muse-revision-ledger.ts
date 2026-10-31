import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const sql = read("supabase/migrations/20261031214507_muse_plan_revision_ledger_v2.sql");
const route = read("app/api/admin/muse-ai/project-plan/route.ts");
const ui = read("components/projects/MuseProjectGuide.tsx");
const browser = read("scripts/verify-muse-project-guide-browser.mjs");
let passed = 0;
function check(name: string, fn: () => void) {
  fn(); passed++; console.log("PASS", name);
}

check("migration adds immutable revision snapshots protected by RLS", () => {
  for (const pattern of [
    /create table public\.muse_project_plan_revisions \(/i,
    /primary key\(plan_id, revision\)/i,
    /alter table public\.muse_project_plan_revisions enable row level security/i,
    /create policy "Owner admins read Muse plan history"/i,
    /grant select on table public\.muse_project_plan_revisions to authenticated/i,
    /revoke all on table public\.muse_project_plan_revisions from public, anon, authenticated/i,
    /create trigger capture_initial_muse_plan_revision/i,
    /insert into public\.muse_project_plan_revisions/i,
    /select p\.id, 1, p\.plan/i,
  ]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete).*public\.muse_project_plan_revisions to authenticated/i);
});

check("existing plan direct mutation is revoked and owner draft insert is constrained", () => {
  assert.match(sql, /revoke all on table public\.muse_project_plans from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert on table public\.muse_project_plans to authenticated/i);
  assert.match(sql, /status = 'draft' and current_revision = 1/i);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /expires_at > now\(\)/i);
});

check("both private write functions recheck identity and lock the saved plan", () => {
  assert.match(sql, /security definer set search_path = ''/i);
  for (const fragment of [
    "private.save_muse_plan_revision_internal",
    "private.apply_muse_plan_revision_internal",
    "for update",
    "created_by = (select auth.uid())",
    "private.is_admin()",
    "saved.current_revision <> expected_revision",
    "old_row.current_revision <> expected_revision",
    "status = 'draft'",
    "expires_at <= now()",
  ]) assert.ok(sql.includes(fragment), "Missing revision guard: " + fragment);
  assert.match(sql, /language sql security invoker set search_path = ''/i);
  assert.doesNotMatch(sql, /create or replace function public\.save_muse_project_plan_revision[\s\S]*?security definer/i);
});

check("old unversioned apply RPC is deleted and grants are narrowed", () => {
  assert.match(sql, /drop function public\.apply_muse_project_plan\(uuid\)/i);
  assert.match(sql, /revoke all on function public\.apply_muse_project_plan\(uuid\) from public, anon, authenticated/i);
  assert.match(sql, /create or replace function public\.apply_muse_project_plan\(\s*target_plan_id uuid, target_project_id uuid, expected_revision integer, expected_count integer/i);
  assert.match(sql, /grant execute on function public\.apply_muse_project_plan\(uuid,uuid,integer,integer\) to authenticated/i);
  assert.match(sql, /applied_revision', saved\.current_revision/i);
});

check("database plan validator enforces complete bounded tasks and subtasks", () => {
  for (const token of [
    "private.validate_muse_plan_task",
    "private.validate_muse_project_plan",
    "item ?& keys",
    "jsonb_typeof(item->'client_visible') <> 'boolean'",
    "jsonb_typeof(item->'estimated_minutes') <> 'number'",
    "jsonb_array_length(p->'subtasks') > 8",
    "total > 48",
    "jsonb_array_length(input_plan->'tasks') not between 1 and 12",
  ]) assert.ok(sql.includes(token), "Missing validator: " + token);
});

check("API requires exact project/revision/task count and checks saved receipts", () => {
  for (const token of [
    'MUSE_PROJECT_GUIDE_ENABLED !== "true"',
    'origin !== new URL(request.url).origin',
    'action === "save_revision"',
    'db.rpc("save_muse_project_plan_revision"',
    'db.rpc("apply_muse_project_plan"',
    "expected_revision: expectedRevision as number",
    "expected_count: expectedCount as number",
    "result.applied_revision !== expectedRevision",
    "result.created_count !== expectedCount",
    "result.saved_revision !== Number(expectedRevision) + 1",
    'parseMuseProjectPlan(payload.plan)',
  ]) assert.ok(route.includes(token), "Missing API guard: " + token);
  assert.doesNotMatch(route, /service_role|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_OPENAI/);
});

check("client review carries revision and browser checks the exact apply payload", () => {
  for (const token of [
    "revision: number",
    "revision: Number(revision)",
    "expected_revision: plan.revision",
    "expected_count: count",
    "data.applied_revision !== plan.revision",
    "Revision {plan.revision}",
  ]) assert.ok(ui.includes(token), "Missing UI guard: " + token);
  assert.match(browser, /assert\.equal\(body\.expected_revision, 1\)/);
  assert.match(browser, /assert\.equal\(body\.expected_count, 2\)/);
});

console.log(`Muse revision ledger: ${passed} source-level checks passed; zero hosted writes.`);
