// Read-only, frozen, explicitly checked production-source inventory (2026-10-28).
// The 2026-10-28 read-only live recheck confirms 25 APPLIED migrations,
// including the owner-reviewed Deep Scan SQL. This test is a frozen source
// inventory check, not a connection to production or a deployment action.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const verifiedAppliedVersions = [
  "20261012020000",
  "20261012020050",
  "20261012020100",
  "20261012030000",
  "20261012040000",
  "20261012040001",
  "20261012050000",
  "20261012060000",
  "20261012070000",
  "20261012080000",
  "20261012080001",
  "20261013033207",
  "20261013040000",
  "20261013050000",
  "20261013050001",
  "20261013060000",
  "20261013232917",
  "20261014060417",
  "20261014070000",
  "20261015001632",
  "20261015001941",
  "20261015005039",
  "20261017030000",
  "20261020063055",
  "20261028090000",
];
const filenames = readdirSync("supabase/migrations").filter(f => f.endsWith(".sql"));
const versions = filenames.map(f => f.split("_")[0]);
assert.equal(verifiedAppliedVersions.length, 25);
assert.equal(new Set(verifiedAppliedVersions).size, 25);
assert.equal(filenames.length, 25, "All 25 applied production migration sources must be represented exactly");
assert.equal(new Set(versions).size, filenames.length, "all migration filenames must have unique version prefixes");
assert.deepEqual([...versions].sort(),
  verifiedAppliedVersions.slice().sort(),
  "A source version is missing, duplicated, or not part of the frozen inventory");
for (const required of [
  "20261017030000_phase3_client_decision_sender_guard.sql",
  "20261020063055_lead_search_review_queue.sql",
  "20261028090000_deep_scan_jobs.sql",
]) assert.ok(filenames.includes(required), "Missing reviewed migration file: " + required);
const deep = readFileSync("supabase/migrations/20261028090000_deep_scan_jobs.sql", "utf8");
assert.match(deep, /alter table public\.deep_scan_jobs enable row level security;/);
assert.match(deep, /security invoker/i);
assert.doesNotMatch(deep, /cron\.schedule|pg_cron/i);
const preflight = readFileSync("scripts/verify-release-preflight.mjs", "utf8");
assert.match(preflight, /Unexpected additional SQL migrations require a new approved inventory review/);
assert.match(preflight, /approvedDeepScanSqlBlobSha = "997b2ffbb0f36223dd72a781c13f0aca24010fd8"/);
assert.match(preflight, /Deep Scan SQL no longer matches the exact owner-approved migration/);
assert.match(preflight, /"20261017030000","20261020063055"/);
assert.match(preflight, /"20261028090000"/);
assert.match(preflight, /migrations\.length, appliedVersions\.length,/);
assert.doesNotMatch(preflight, /not yet counted as applied|const proposedVersion/);
console.log("verify:deep-migration-inventory — all 25 APPLIED migration source versions and pinned Deep Scan SQL represented; no database writes.");
