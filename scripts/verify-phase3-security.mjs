import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
function file(path) { return readFileSync(new URL(path, "file://" + root), "utf8"); }

const sql = file("supabase/migrations/20261017030000_phase3_client_decision_sender_guard.sql");
const portal = file("app/(protected)/portal/projects/[projectId]/actions.ts");
const olderPolicies = file("supabase/migrations/20261012040001_phase4_client_approvals.sql");
const olderMessages = file("supabase/migrations/20261012050000_phase5_portal.sql");
const timestamp = file("supabase/migrations/20261012020050_phase2_auth_helpers.sql");

// These are fast, offline source-level contract checks. Not a substitute
// for real PostgreSQL behavior and negative cases in a disposable database.
const checks = [
  ["Phase 3 migration is private-draft-only", () => {
    assert.match(sql, /DRAFT ONLY/);
    assert.doesNotMatch(sql, /(?:alter\s+table\s+public\.profiles|update\s+public\.approvals|delete\s+from\s+public\.)/i);
  }],
  ["Approvals guarded by a security-invoker trigger", () => {
    assert.match(sql, /create or replace function private\.guard_client_approval_decision\(\)/i);
    assert.match(sql, /security invoker/i);
    assert.match(sql, /create trigger zz_guard_client_approval_decision\s+before update on public\.approvals/i);
    assert.match(sql, /execute function private\.guard_client_approval_decision\(\)/i);
    assert.match(sql, /old\.status <> 'pending'/i);
    assert.match(sql, /new\.status not in \('approved', 'declined'\)/i);
  }],
  ["Metadata immutable including future-added columns", () => {
    const minus = sql.match(/to_jsonb\((?:old|new)\)\s*-\s*array\[/gi) || [];
    assert.equal(minus.length, 2);
    for (const side of ["new", "old"]) {
      assert.match(sql, new RegExp("to_jsonb\\(" + side + "\\)\\s*-\\s*array\\[\\s*'status',\\s*'client_comment',\\s*'decided_by',\\s*'decided_at',\\s*'updated_at'"));
    }
    assert.match(sql, /is distinct from/i);
    assert.match(sql, /raise exception 'Approval metadata is not editable/i);
  }],
  ["Approval identity and date are server verified", () => {
    assert.match(sql, /new\.decided_by is distinct from \(select auth\.uid\(\)\)/i);
    assert.match(sql, /new\.decided_at := pg_catalog\.statement_timestamp\(\)/i);
    assert.match(sql, /length\(coalesce\(new\.client_comment, ''\)\) > 280/i);
    assert.match(sql, /decided_by = \(select auth\.uid\(\)\)\s+and decided_at is not null/i);
  }],
  ["Client approvals still check OLD/NEW project permissions", () => {
    assert.match(olderPolicies, /"Clients decide own pending approvals"/);
    assert.match(sql, /drop policy if exists "Clients decide own pending approvals" on public\.approvals/i);
    assert.match(sql, /using \(\s*status = 'pending'\s+and \(select private\.can_access_project\(project_id\)\)\s*\)/i);
    assert.match(sql, /with check \(\s*status in \('approved', 'declined'\)/i);
  }],
  ["Messages enforce sender identity in client INSERT policy", () => {
    assert.match(olderMessages, /"Clients send project messages"/);
    assert.match(sql, /drop policy if exists "Clients send project messages" on public\.messages/i);
    assert.match(sql, /for insert to authenticated\s+with check \(\s*sender_id = \(select auth\.uid\(\)\)/i);
    assert.match(sql, /private\.can_access_project\(project_id\)/i);
  }],
  ["Existing admin and server-side action paths remain compatible", () => {
    assert.match(sql, /private\.is_admin\(\)/);
    assert.match(sql, /current_user in \('postgres', 'service_role'\)/);
    assert.match(portal, /decided_by:\s*user\.id/);
    assert.match(portal, /sender_id:\s*user\.id/);
    assert.match(timestamp, /create trigger set_%I_updated_at before update/);
    assert.ok("set_approvals_updated_at" < "zz_guard_client_approval_decision", "Trigger name order must keep timestamp update first");
  }],
];

let failures = 0;
for (const [name, test] of checks) {
  try {
    test();
    console.log("PASS", name);
  } catch (error) {
    failures++;
    console.error("FAIL", name, String(error.message));
  }
}
console.log(checks.length - failures + "/" + checks.length + " source-level checks passed (no DB writes)");
if (failures) process.exitCode = 1;
