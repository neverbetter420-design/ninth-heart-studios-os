// Read-only scanner attribution tests; never uses production data or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildScannerOutcomeSnapshot, type ScannerOutcomeProspect,
  type ScannerOutcomeLead, type ScannerProjectEvent } from "../lib/prospect-conversion.ts";

const prospect = (id: string, extra: Partial<ScannerOutcomeProspect> = {}): ScannerOutcomeProspect => ({
  id, category: "pub", source_ref: "node:" + id, status: "new",
  outreach_status: "none", lead_id: null, ...extra,
});
const lead = (id: string, pId: string, extra: Partial<ScannerOutcomeLead> = {}): ScannerOutcomeLead => ({
  id, status: "contacted", last_reply_at: null, consultation_at: null,
  metadata: { source: "prospect_scanner", prospect_id: pId }, ...extra,
});
const projects: ScannerProjectEvent[] = [
  { lead_id: "l1", project_id: "project-1", event_type: "project_created" },
  { lead_id: "l1", project_id: "project-2", event_type: "project_created" },
  { lead_id: "l3", project_id: "project-3", event_type: "project_created" },
  { lead_id: "l2", project_id: null, event_type: "project_created" },
  { lead_id: "l2", project_id: "project-4", event_type: "non_conversion" },
];
const prospects = [
  prospect("p1", { status: "promoted", outreach_status: "sent", lead_id: "l1" }),
  prospect("p2", { status: "promoted", category: "hairdresser", lead_id: "l2" }),
  prospect("p3", { category: "restaurant", outreach_status: "drafted" }),
  prospect("p4", { status: "promoted", outreach_status: "sent", lead_id: "l3" }),
  prospect("p5", { status: "archived" }),
];
const leads = [
  lead("l1", "p1", { status: "engaged", last_reply_at: "2026-10-27T12:00:00Z",
    consultation_at: "2026-11-01T15:00:00Z" }),
  lead("l2", "p2", { status: "not_interested", consultation_at: "2026-11-02T15:00:00Z" }),
  lead("l3", "OTHER", { status: "engaged", last_reply_at: "2026-10-27T15:00:00Z" }),
  lead("inbound", "p1", { metadata: { source: "contact_form", prospect_id: "p1" },
    last_reply_at: "2026-10-26T10:00:00Z" }),
];
const snapshot = buildScannerOutcomeSnapshot(prospects, leads, projects);
assert.deepEqual(snapshot.totals, {
  saved_records: 5, drafts_open: 1, marked_sent: 2, linked_leads: 2,
  replies_recorded: 1, consultations_scheduled: 2,
  projects_created: 1, declined: 1,
});
assert.equal(snapshot.unmatched_promotions, 1);
assert.equal(snapshot.categories.find(c => c.category === "bars")?.saved_records, 3);
assert.equal(snapshot.categories.find(c => c.category === "salons")?.consultations_scheduled, 1);
assert.equal(snapshot.categories.find(c => c.category === "restaurants")?.drafts_open, 1);
assert.equal(snapshot.categories.find(c => c.category === "bars")?.projects_created, 1);
assert.equal(buildScannerOutcomeSnapshot([], [], []).totals.saved_records, 0);
assert.equal(buildScannerOutcomeSnapshot(prospects, [], projects).totals.projects_created, 0,
  "same-name or unlinked project events may not be credited to scanner results");
const corrupt = buildScannerOutcomeSnapshot([
  prospect("one", { status: "promoted", lead_id: "l1" }),
], [lead("l1", "one", { last_reply_at: "not a date" })], []);
assert.equal(corrupt.totals.linked_leads, 1);
assert.equal(corrupt.totals.replies_recorded, 0, "malformed timestamps cannot count as replies");
// A scheduled meeting is not proof it happened, nor a commercial win.
const two = buildScannerOutcomeSnapshot([
  prospect("one", { status: "promoted", lead_id: "l1" }),
], [lead("l1", "one", { consultation_at: "2026-12-01T18:00:00Z" })], []);
assert.equal(two.totals.consultations_scheduled, 1);
assert.equal(two.totals.projects_created, 0);
assert.ok(!Object.hasOwn(two.totals, "roi"));
assert.ok(!Object.hasOwn(two.totals, "won"));
assert.equal(buildScannerOutcomeSnapshot([
  prospect("one", { status: "promoted", lead_id: "l1" }),
], [lead("l1", "one", { metadata: { source: "prospect_scanner", prospect_id: "other" } })], []
).unmatched_promotions, 1);

const page = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(page, /await requireAdmin\(\)/);
assert.match(page, /from\("prospects"\)[\s\S]*?source_ref, category, status, outreach_status, lead_id/);
assert.match(page, /from\("leads"\)[\s\S]*?last_reply_at, consultation_at, metadata/);
assert.match(page, /from\("activities"\)[\s\S]*?project_created/);
assert.match(page, /q\.data\.length < 1000 && typeof q\.count === "number" && q\.count < 1000/);
assert.match(page, /No partial or estimated conversion figures/);
assert.match(page, /is not recorded revenue/);
assert.match(page, /What happened next/);
assert.doesNotMatch(page, /Revenue:\s*\{/);
console.log("verify:prospect-conversion — strictly linked outcomes with no invented ROI passed.");
