// Territory Intelligence acceptance checks: saved evidence only, no network or DB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createScanTerritory, compareSavedTerritories, type TerritoryProspect } from "../lib/prospect-territories.ts";
import { rateProspect } from "../lib/prospect-curation.ts";
import type { WebsiteSignals } from "../lib/prospect-scan.ts";

const base: WebsiteSignals = {
  has_website: true, reachable: true, https: true, mobile_viewport: true,
  builder: null, title_ok: true, description_ok: true, stale_copyright: false,
  copyright_year: null, load_ms: 250, page_bytes: 2200,
};
const areaA = createScanTerritory("Puyallup, WA", "Puyallup, Pierce County", 10,
  ["bars", "restaurants"], "2026-10-28T10:00:00Z");
const areaB = createScanTerritory("Tacoma, WA", "Tacoma, Pierce County", 15,
  ["bars", "salons"], "2026-10-28T11:00:00Z");
assert.equal(areaA.location, "Puyallup, WA");
assert.equal(areaA.radius_mi, 10);
assert.deepEqual(areaA.niches, ["bars", "restaurants"]);
assert.throws(() => createScanTerritory("X", "Puyallup", 10, ["bars"], "2026-10-28T11:00:00Z"));
assert.throws(() => createScanTerritory("Puyallup, WA", "Puyallup", 51, ["bars"], "2026-10-28T11:00:00Z"));
assert.throws(() => createScanTerritory("Puyallup, WA", "Puyallup", 10, [], "2026-10-28T11:00:00Z"));
const record = (id: string, extra: Partial<TerritoryProspect> = {}): TerritoryProspect => ({
  id, source_ref: "node:" + id, business_name: "Same Name Pub", category: "pub",
  address: "123 Main St, Puyallup, WA", phone: "253-555-0199",
  website: "https://realdomain.com/",
  signals: { ...base, scan_territory: areaA },
  status: "new", outreach_status: "none", opportunity_score: 55,
  scanned_at: "2026-10-28T10:00:00Z",
  ...extra,
});
const first = record("100");
const secondSameName = record("101", { phone: "253-555-0101", address: "200 Main St, Puyallup, WA" });
const lowEvidence = record("102", { phone: null, website: null,
  signals: { ...base, reachable: false, has_website: false, scan_territory: areaA } });
const tacoma = record("103", { signals: { ...base, scan_territory: areaB } });
const unknown = record("104", { signals: base });
const compare = compareSavedTerritories([first, secondSameName, lowEvidence, tacoma, unknown]);
assert.equal(compare.areas.length, 2);
assert.equal(compare.with_context, 4);
assert.equal(compare.without_context, 1, "legacy prospects are not silently assigned a location");
assert.deepEqual(compare.areas.map(x => x.location), ["Puyallup, WA", "Tacoma, WA"]);
assert.equal(compare.areas[0].saved, 3);
assert.equal(compare.areas[0].qualified, 2);
assert.equal(compare.areas[1].saved, 1);
assert.equal(compare.areas[1].qualified, 1);
assert.equal(compare.areas[0].top_categories[0].category, "bars");
assert.equal(compare.areas[0].top_categories[0].count, 2);
assert.equal(compare.areas[0].average_quality, Math.round(
  (rateProspect(first).quality + rateProspect(secondSameName).quality) / 2
));
assert.ok(compare.areas[0].best_quality !== null);
assert.equal(compare.areas[1].radius_mi, 15);
assert.ok(compare.areas[0].latest_checked_at.startsWith("2026-10-28"));
// Same source ID is one directory listing, even if two database records exist.
const duplicate = record("dup", { source_ref: first.source_ref,
  business_name: first.business_name, phone: first.phone,
  outreach_status: "sent", opportunity_score: 5 });
const guarded = compareSavedTerritories([first, duplicate, secondSameName]);
assert.equal(guarded.areas[0].saved, 2);
assert.equal(guarded.areas[0].qualified, 1,
  "outreach-protected duplicate takes precedence over an uncontacted copy");
const reverse = compareSavedTerritories([duplicate, first, secondSameName]);
assert.equal(reverse.areas[0].qualified, 1,
  "protection must not depend on database return order");
const onlyUnknown = compareSavedTerritories([unknown]);
assert.equal(onlyUnknown.areas.length, 0);
assert.equal(onlyUnknown.without_context, 1);
// Malformed saved JSON is not a valid search area or comparable sample.
const invalid = record("bad", { signals: {
  ...base, scan_territory: { ...areaA, radius_mi: 0 },
}});
assert.equal(compareSavedTerritories([invalid]).without_context, 1);
assert.equal(compareSavedTerritories([first, tacoma], 1).areas.length, 1);
assert.equal(compareSavedTerritories([first, tacoma], 100).areas.length, 2);

const actions = readFileSync("app/(protected)/(admin)/leads/discover/actions.ts", "utf8");
const page = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(actions, /scan_territory: scanTerritory/);
assert.match(actions, /createScanTerritory\(location, areaLabel, radiusMi, niches, checkedAt\)/);
assert.match(actions, /p\.signals\?\.scan_territory/);
assert.match(page, /compareSavedTerritories\(shortlistData as SavedChallenger\[\]\)/);
assert.match(page, /!shortlistReady \|\| !territoryComparison/);
assert.match(page, /Prefill repeat scan/);
assert.match(page, /not market coverage/);
assert.match(page, /#scan-controls/);
assert.match(page, /maxLength=\{160\}/);
assert.match(page, /selectedNiches\.includes\(key\)/);
assert.doesNotMatch(actions, /cron\.schedule|autoRescan/);
console.log("verify:prospect-territories — safe saved-area comparison and manual prefill passed.");
