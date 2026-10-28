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
console.log("verify:deep-integration — client/lead guards, manual batches and scan memory wired safely.");
