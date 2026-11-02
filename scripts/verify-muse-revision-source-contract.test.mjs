import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migration-candidates/20261031214507_muse_plan_revision_ledger_v2.sql",
  "utf8",
);

const fn = (name) => {
  const start = sql.indexOf("create or replace function " + name + "(");
  assert.ok(start >= 0, "Missing function " + name);
  const end = sql.indexOf("\n$$;", start);
  assert.ok(end > start, "Missing function terminator " + name);
  return sql.slice(start, end);
};

test("revision save requires admin, owner, project, draft and expected version", () => {
  const body = fn("private.save_muse_plan_revision_internal");
  for (const marker of [
    "private.is_admin()", "auth.uid()", "p.project_id = target_project_id",
    "p.created_by =", "p.status = 'draft'", "for update",
    "old_row.current_revision <> expected_revision",
    "r.plan = old_row.plan",
  ]) assert.ok(body.includes(marker), "Missing save guard: " + marker);
});

test("apply checks owner, exact project, revision, count and ledger", () => {
  const body = fn("private.apply_muse_plan_revision_internal");
  for (const marker of [
    "private.is_admin()", "auth.uid()", "p.created_by =",
    "saved.project_id is distinct from target_project_id",
    "saved.current_revision <> expected_revision",
    "r.plan = saved.plan", "expected_count", "for update",
  ]) assert.ok(body.includes(marker), "Missing apply guard: " + marker);
});

test("direct authenticated writes to revision history are not granted", () => {
  assert.match(sql, /revoke all on table public\.muse_project_plan_revisions from public, anon, authenticated;/);
  assert.match(sql, /grant select on table public\.muse_project_plan_revisions to authenticated;/);
  assert.match(sql, /grant select, insert on table public\.muse_project_plans to authenticated;/);
});

test("old single-argument apply RPC is dropped", () => {
  assert.match(sql, /drop function public\.apply_muse_project_plan\(uuid\);/);
});

test("private privileged functions use fixed search paths", () => {
  for (const name of [
    "private.save_muse_plan_revision_internal",
    "private.apply_muse_plan_revision_internal",
  ]) assert.match(fn(name), /security definer set search_path = ''/);
});

// IMPORTANT: These are source-contract checks, NOT proof of project ownership.
// Cross-project inserts and privileged writes must be tested against disposable
// Supabase with two admin users. Do not infer authorization from these tests.
