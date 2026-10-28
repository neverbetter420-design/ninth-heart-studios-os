// Scan Memory: pure observation comparisons, no live database or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { updateScanMemory } from "../lib/prospect-scan-memory.ts";
import { auditIndustryHomepage } from "../lib/prospect-industry-audit.ts";
import type { WebsiteSignals } from "../lib/prospect-scan.ts";

const first = "2026-10-27T10:00:00.000Z";
const later = "2026-10-28T10:00:00.000Z";
const template: WebsiteSignals = {
  has_website: true, reachable: true, https: true, mobile_viewport: true,
  builder: null, title_ok: true, description_ok: true, stale_copyright: false,
  copyright_year: null, load_ms: 400, page_bytes: 3000,
};
const oldAudit = auditIndustryHomepage("restaurants", "<p>Welcome</p>", first);
const newAudit = auditIndustryHomepage("restaurants", '<a href="/order">Order online</a>', later);
const oldRecord = { website: "https://oldcafe.com/", phone: "253-555-0199",
  scanned_at: first, signals: { ...template, industry_audit: oldAudit } };
const social = {
  platform: "instagram" as const, source: "listing" as const,
  url: "https://www.instagram.com/newcafe/",
  status: "matched" as const, evidence: "name and phone matched"
};
const nextRecord = { website: "https://newcafe.com/", phone: "253-555-0188",
  scanned_at: later, signals: { ...template, industry_audit: newAudit,
    social_profiles: [social] } };
const initial = updateScanMemory(null, oldRecord, first);
assert.equal(initial.version, 1);
assert.equal(initial.events.length, 0, "first observation is a baseline, not a change");
assert.equal(initial.last_checked_at, first);
const changes = updateScanMemory(oldRecord, nextRecord, later);
assert.deepEqual(changes.events.map(x => x.key),
  ["listed-phone", "website-url", "social-instagram", "homepage-ordering"]);
assert.equal(changes.events[0].kind, "review");
assert.equal(changes.events[2].kind, "new_evidence");
assert.ok(changes.events.every(x => x.at === later));
assert.ok(changes.events.every(x =>
  !/business closed|removed service|website broken|not mobile friendly/i.test(x.description)));
// A network failure is not evidence of negative business changes.
const outage = updateScanMemory({ ...nextRecord, signals: {
  ...nextRecord.signals, scan_memory: changes,
} }, { website: null, phone: null, signals: {
  ...template, has_website: false, reachable: false, social_profiles: [],
} }, "2026-10-28T11:00:00.000Z");
assert.deepEqual(outage.events, changes.events, "outages preserve prior observations");
assert.equal(outage.last_checked_at, "2026-10-28T11:00:00.000Z");
// A previously observed homepage feature no longer visible on the homepage is
// not proof the feature was removed. Do not create negative change records.
const notNowVisible = updateScanMemory({ ...nextRecord, signals: {
  ...nextRecord.signals, scan_memory: changes,
} }, { ...nextRecord, signals: {
  ...template, industry_audit: oldAudit,
  social_profiles: [social],
} }, "2026-10-28T12:00:00.000Z");
assert.deepEqual(notNowVisible.events, changes.events);
const again = updateScanMemory({
  ...nextRecord, signals: { ...nextRecord.signals, scan_memory: changes },
}, nextRecord, "2026-10-28T13:00:00.000Z");
assert.deepEqual(again.events, changes.events, "repeated same evidence creates no duplicate events");
const longEvents = Array.from({ length: 20 }, (_, i) => ({
  at: first, key: "event-" + i, description: "Public evidence changed",
  source: "directory" as const, kind: "review" as const,
}));
const limited = updateScanMemory({
  ...oldRecord, signals: { ...oldRecord.signals, scan_memory: {
    version: 1 as const, last_checked_at: first, events: longEvents
  } }
}, oldRecord, later);
assert.equal(limited.events.length, 12, "history must not grow without a bound");
assert.equal(limited.events[0].key, "event-8");
const scanner = readFileSync("app/(protected)/(admin)/leads/discover/actions.ts", "utf8");
assert.match(scanner, /updateScanMemory\(existingRecord, b, checkedAt\)/);
assert.match(scanner, /updateScanMemory\(p, \{ website, phone: p\.phone, signals \}, checkedAt\)/);
assert.match(scanner, /scan_memory: memory/);
const ui = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(ui, /Evidence history/);
assert.match(ui, /A changed signal/);
console.log("verify:prospect-scan-memory — 12-event bounded, cautious change evidence passed.");
