// Read-only, frozen, explicitly checked production-source inventory (2026-10-28).
// The 2026-10-30 read-only live recheck confirms 26 APPLIED migrations,
// including Deep Scan and Muse Project Guide v1. This remains a frozen source
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
  "20261029184832",
];
const proposedVersions = [];
const filenames = readdirSync("supabase/migrations").filter(f => f.endsWith(".sql"));
const versions = filenames.map(f => f.split("_")[0]);
assert.equal(verifiedAppliedVersions.length, 26);
assert.equal(new Set(verifiedAppliedVersions).size, 26);
assert.equal(filenames.length, 26, "All 26 recorded production migration versions must be represented exactly");
assert.equal(new Set(versions).size, filenames.length, "all migration filenames must have unique version prefixes");
assert.deepEqual([...versions].sort(), [...verifiedAppliedVersions, ...proposedVersions].sort(),
  "A source version is missing, duplicated, or not part of the recorded production inventory");
for (const required of [
  "20261017030000_phase3_client_decision_sender_guard.sql",
  "20261020063055_lead_search_review_queue.sql",
  "20261028090000_deep_scan_jobs.sql",
]) assert.ok(filenames.includes(required), "Missing reviewed migration file: " + required);
assert.ok(filenames.includes("20261029184832_muse_project_guide_v1.sql"), "Missing recorded Project Guide migration");
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
assert.match(preflight, /const proposedVersions = \[\]/);
assert.match(preflight, /migrations\.length, appliedVersions\.length \+ proposedVersions\.length,/);
assert.doesNotMatch(preflight, /not yet counted as applied/);
console.log("verify:deep-migration-inventory — 26 recorded applied sources represented; no database writes.");
