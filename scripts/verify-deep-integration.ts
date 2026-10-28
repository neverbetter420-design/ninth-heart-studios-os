// Deep Scan integration QA (pure static checks plus conservative identity).
// No production database or external API calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkBusinessIdentity, type ClientIdentity } from "../lib/prospect-identity.ts";
import { createScanTerritory } from "../lib/prospect-territories.ts";
import { updateScanMemory } from "../lib/prospect-scan-memory.ts";
import { nextDeepScanBatch } from "../lib/deep-scan.ts";
import type { ComparableProspect, ExistingLead } from "../lib/prospect-curation.ts";

const subject: ComparableProspect = {
  source_ref: "node:100", business_name: "Pine & Rose Pub", category: "pub",
  website: "https://pinerose.com", phone: "253-555-0188",
  address: "100 Main Street, Puyallup, WA", status: "new",
  outreach_status: "none",
};
const knownClient: ClientIdentity = {
  id: "real-client", name: "Pine and Rose Pub",
  website: "https://pinerose.com/", status: "active",
};
const knownLead: ExistingLead = {
  business_name: "Pine and Rose Pub", website: "https://pinerose.com/",
  phone: "253-555-0188", metadata: { category: "bars" },
};
assert.equal(checkBusinessIdentity(subject, [], [], [knownClient]).action, "protect");
assert.equal(checkBusinessIdentity(subject, [], [knownLead], []).action, "protect");
assert.equal(checkBusinessIdentity(subject, [
  { ...subject, id: "saved-sent", source_ref: subject.source_ref, outreach_status: "sent" },
], [], []).action, "protect");
assert.equal(checkBusinessIdentity(subject, [
  { ...subject, id: "other-listing", source_ref: "node:199" },
], [], []).action, "review");
const ctx = createScanTerritory("Puyallup, WA", "Puyallup", 25, ["bars"],
  "2026-10-28T10:00:00Z");
assert.equal(ctx.radius_mi, 25);
const old = { website: "https://pinerose.com/", phone: "253-555-0188",
  signals: { has_website: true, reachable: true } };
const refresh = updateScanMemory(old, {
  ...old, phone: "253-555-0199",
}, "2026-10-28T11:00:00Z");
assert.ok(refresh.events.some(x => x.key === "listed-phone"));
assert.equal(nextDeepScanBatch([], 0).length, 0);

const action = readFileSync("app/(protected)/(admin)/leads/discover/deep-actions.ts", "utf8");
const ui = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
const curation = readFileSync("lib/prospect-curation.ts", "utf8");
const sql = readFileSync("supabase/migrations/20261028090000_deep_scan_jobs.sql", "utf8");
assert.match(action, /await requireAdmin\(\)/);
assert.match(action, /const \[priorRows, leadRows, clientRows\] = await Promise\.all/);
assert.match(action, /from\("clients"\)/);
assert.match(action, /read\.data\.length >= 1000/);
assert.match(action, /typeof read\.count !== "number" \|\| read\.count >= 1000/);
assert.match(action, /const identity = checkBusinessIdentity\(candidate/);
assert.match(action, /identity\.action !== "allow"/);
assert.match(action, /candidatePool: typeof analyzed = \[\]/);
assert.match(action, /updateScanMemory\(oldRecord, b, checkedAt\)/);
assert.match(action, /scan_memory: memory, scan_territory: territory/);
assert.match(action, /createScanTerritory\(/);
assert.match(action, /\.eq\("status", "new"\)\.eq\("outreach_status", "none"\)\.is\("outreach_draft", null\)/);
// A 90s lease can expire during slow external site/social checks.
// Verify the server renews ONLY the active token after each wave and before
// every write, and never attempts to continue after an RPC denial.
assert.match(action, /const renewOwnedLease = async \(\) =>/);
assert.match(action, /"renew_deep_scan_batch", \{ p_id: id, p_lease: lease \}/);
assert.match(action, /renewError \|\| !active \|\| active\.lease_token !== lease/);
assert.match(action, /await renewOwnedLease\(\);\s*\n\s*}\s*\n\s*\/\/ Query relationship history AFTER/);
assert.match(action, /await renewOwnedLease\(\);\s*\n\s*const result = existingId/);
assert.match(action, /await renewOwnedLease\(\);\s*\n\s*const \{ data: finished/);
assert.match(action, /Number\.isInteger\(radiusMi\) \|\| radiusMi < 1 \|\| radiusMi > 50/);
assert.ok(action.indexOf("const [priorRows, leadRows, clientRows]") >
  action.indexOf("const analyzed: Array<ComparableProspect"),
  "relationship history must be read AFTER external website queries");
const renewSql = sql.match(/create or replace function public\.renew_deep_scan_batch[\s\S]*?(?=-- Finish only)/)?.[0];
assert.ok(renewSql, "Missing bounded owner-only lease renewal RPC");

assert.match(renewSql, /as \$\$\s*\n[\s\S]*?\n\$\$;/,
  "A renewal RPC must be fully dollar-quoted; local migration replay rejects a single dollar");

for (const needle of [
  /security invoker/, /j\.created_by = \(select auth\.uid\(\)\)/,
  /\(select private\.is_admin\(\)\)/, /j\.status = 'running'/,
  /j\.lease_token = p_lease/, /j\.lease_until > now\(\)/,
]) assert.match(renewSql, needle);
assert.match(sql, /grant execute on function public\.renew_deep_scan_batch\(uuid,uuid\) to authenticated/);
assert.match(sql, /revoke all on function public\.renew_deep_scan_batch\(uuid,uuid\) from public, anon/);

assert.match(action, /await supabase\.rpc\("finish_deep_scan_batch"/);
assert.match(action, /await supabase\.rpc\("pause_deep_scan_batch"/);
assert.doesNotMatch(action, /matchesExistingLead\(/);
assert.match(curation, /Math\.min\(100, Math\.floor\(analyzeLimit\)\)/);
assert.match(ui, /Deep Scan progress/);
assert.match(ui, /disabled=\{!!deepError\}/);
assert.match(ui, /role="progressbar"/);
assert.match(ui, /Process next six/);
assert.match(ui, /The database migration must/);
assert.match(sql, /alter table public\.deep_scan_jobs enable row level security;/);
assert.doesNotMatch(sql, /cron\.schedule|pg_cron/i);

assert.ok(sql.includes("p_created + p_refreshed + p_held + p_conflicts = p_processed"),
  "no partial or inconsistent batch counters may be committed");
assert.ok(sql.includes("create or replace function public.cancel_deep_scan_job(p_id uuid)"),
  "owner cancellation must be performed atomically on the job row");
const cancelSql = sql.split("create or replace function public.cancel_deep_scan_job(p_id uuid)")[1]
  ?.split("revoke all on function public.claim_deep_scan_batch")[0];
assert.ok(cancelSql && cancelSql.includes("security invoker") &&
  cancelSql.includes("j.created_by = (select auth.uid())") &&
  cancelSql.includes("(select private.is_admin())") &&
  cancelSql.includes("j.status in ('ready', 'paused')") &&
  cancelSql.includes("j.status = 'running' and j.lease_until < now()") &&
  cancelSql.includes("lease_token = null, lease_until = null"),
  "cancellation must never preempt a live lease or cross an owner's RLS boundary");
assert.ok(sql.includes("grant execute on function public.cancel_deep_scan_job(uuid) to authenticated"));
assert.ok(sql.includes("revoke all on function public.cancel_deep_scan_job(uuid) from public, anon"));
const pauseSql = sql.split("create or replace function public.pause_deep_scan_batch")[1]
  ?.split("-- Owner cancellation")[0];
assert.ok(pauseSql?.includes("j.lease_token = p_lease and j.lease_until > now()"),
  "expired workers must not pause jobs with stale tokens");
assert.ok(action.includes('supabase.rpc("cancel_deep_scan_job"'),
  "server cancellation must use the atomic owner-only DB RPC");
assert.ok(ui.includes('(["ready", "paused"].includes(job.status) || (job.status === "running" && expired))'),
  "expired-running and paused jobs must offer owner-controlled cancellation");

console.log("verify:deep-integration — client/lead guards, manual batches and scan memory wired safely.");
