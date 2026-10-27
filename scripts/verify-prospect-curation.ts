// Pure scanner curation acceptance tests. No network, database or credentials.
import assert from "node:assert/strict";
import { categoryBucket, isContactable, reliabilityScore, rateProspect,
  prioritizeDiscovered, protectedFromScannerUpdate, curateProspects,
  type ComparableProspect } from "../lib/prospect-curation.ts";
import type { DiscoveredBusiness, WebsiteSignals } from "../lib/prospect-scan.ts";

const missing: WebsiteSignals = {
  has_website: false, reachable: false, https: false, mobile_viewport: false,
  builder: null, title_ok: false, description_ok: false, stale_copyright: false,
  copyright_year: null, load_ms: null, page_bytes: null,
};
const liveSite: WebsiteSignals = { ...missing, has_website: true, reachable: true };
const raw = (name: string, category: string, source_ref: string, extra: Partial<DiscoveredBusiness> = {}): DiscoveredBusiness => ({
  source_ref, name, category, address: null, phone: null, website: null,
  lat: 47.1, lng: -122.3, social_profiles: [], ...extra,
});
const candidate = (name: string, category: string, id: string, extra: Partial<ComparableProspect> = {}): ComparableProspect => ({
  source_ref: id, business_name: name, category, address: null, phone: null,
  website: null, signals: missing, opportunity_score: 10,
  status: "new", outreach_status: "none", ...extra,
});
const old = (name: string, category: string, id: string, extra: Partial<ComparableProspect> = {}) =>
  ({ id, ...candidate(name, category, "node:" + id.replace(/\D/g, "") || "10", extra) });

assert.equal(categoryBucket("bar"), "bars");
assert.equal(categoryBucket("pub"), "bars");
assert.equal(categoryBucket("catering.pub"), "bars");
assert.equal(categoryBucket("hairdresser"), "salons");
assert.equal(categoryBucket("service.beauty.hairdresser"), "salons");
assert.equal(categoryBucket("catering.restaurant"), "restaurants");
assert.equal(categoryBucket("unknown"), "other");
const justName = candidate("Listing Only", "bar", "node:101");
assert.equal(isContactable(justName), false, "OSM name and coordinates alone aren't contact proof");
assert.ok(reliabilityScore(justName) < 45);
const phoneLead = candidate("Contactable", "bar", "node:102", { phone: "253-555-0111", address: "Puyallup, WA" });
assert.equal(isContactable(phoneLead), true);
assert.ok(reliabilityScore(phoneLead) >= 45);
const unverifiedSocial = candidate("Unverified", "bar", "node:103", { signals: {
  ...missing, social_profiles: [{ platform: "instagram", url: "https://www.instagram.com/example/",
    source: "listing", status: "unconfirmed", evidence: "Listed only" }],
}});
assert.equal(isContactable(unverifiedSocial), false, "unconfirmed social link is insufficient");
const verifiedSocial = { ...unverifiedSocial, signals: {
  ...unverifiedSocial.signals, social_profiles: [{
    platform: "instagram" as const, url: "https://www.instagram.com/example/",
    source: "listing" as const, status: "matched" as const, evidence: "Name and address confirmed",
  }],
}};
assert.equal(isContactable(verifiedSocial), true);
assert.ok(reliabilityScore(verifiedSocial) > reliabilityScore(unverifiedSocial));
assert.ok(rateProspect({ ...phoneLead, opportunity_score: 40 }).quality >
  rateProspect({ ...phoneLead, opportunity_score: 10 }).quality);

const found = prioritizeDiscovered([
  raw("Rest 1", "restaurant", "node:1", { website: "https://restaurant-a.com" }),
  raw("Rest 2", "restaurant", "node:2", { phone: "555-0002" }),
  raw("Rest 3", "restaurant", "node:3", { phone: "555-0003" }),
  raw("Bar 1", "pub", "node:4", { phone: "555-0004" }),
  raw("Salon 1", "hairdresser", "node:5", { phone: "555-0005" }),
  raw("Bar Duplicate", "pub", "node:4", { phone: "555-0004" }),
], ["restaurants", "bars", "salons"], 3);
assert.deepEqual(found.map(p => categoryBucket(p.category)), ["restaurants", "bars", "salons"],
  "all selected categories receive a turn even when restaurant results dominate");
assert.equal(new Set(found.map(p => p.source_ref)).size, 3);

const weakSaved = Array.from({ length: 12 }, (_, i) => old("Weak incumbent " + i,
  "pub", "old" + (i + 1), { phone: null, signals: missing, opportunity_score: 10 }));
const stronger = candidate("Better pub", "bar", "node:999",
  { address: "123 Main St", phone: "253-555-0100", opportunity_score: 65 });
const weakNew = candidate("Unreachable bar", "pub", "node:998", { opportunity_score: 70 });
const ranked = curateProspects([weakNew, stronger], weakSaved, 12, 12);
assert.deepEqual(ranked.winners.map(x => x.prospect.business_name), ["Better pub"],
  "a verifiably contactable candidate beats lower-quality category incumbents");
assert.equal(ranked.rejected, 1, "uncontactable listing held back");
assert.equal(ranked.winners[0].compared, 12);
assert.equal(ranked.winners[0].category, "bars");
assert.equal(weakSaved.length, 12, "no existing records deleted or modified");

const sent = old("Active account", "bar", "protected10", {
  source_ref: "node:803", phone: "253-555-0103", outreach_status: "sent",
});
const promoted = old("Promoted", "hairdresser", "protected20", {
  source_ref: "node:804", phone: "253-555-0104", status: "promoted",
});
const drafted = old("Drafted", "pub", "protected30", {
  source_ref: "node:805", phone: "253-555-0105", outreach_draft: "Initial outreach draft",
});
assert.ok([sent, promoted, drafted].every(protectedFromScannerUpdate));
const protectedScan = curateProspects([
  candidate("Active account", "pub", "node:803", { phone: "253-555-0103" }),
  candidate("Promoted", "hairdresser", "node:804", { phone: "253-555-0104" }),
  candidate("Drafted", "pub", "node:805", { phone: "253-555-0105" }),
], [sent, promoted, drafted]);
assert.equal(protectedScan.winners.length, 0);
assert.equal(protectedScan.protectedCount, 3);

const bestPrevious = old("Existing best", "bar", "incumbent21", {
  source_ref: "node:900", website: "https://strongsite.com",
  address: "123 St", phone: "253-555-0133", signals: liveSite, opportunity_score: 70,
});
const worseRefresh = candidate("Existing best", "bar", "node:900", {
  phone: "253-555-0133", signals: missing, opportunity_score: 10,
});
assert.equal(curateProspects([worseRefresh], [bestPrevious]).winners.length, 0,
  "transient analysis failure must not downgrade reliable existing record");

const strongRefresh = candidate("Existing best", "bar", "node:900", {
  website: "https://strongsite.com", address: "123 St", phone: "253-555-0133",
  signals: liveSite, opportunity_score: 80,
});
assert.equal(curateProspects([strongRefresh], [bestPrevious]).winners[0].existingId,
  bestPrevious.id, "stable OSM identity refreshes instead of duplicating");
assert.equal(curateProspects([strongRefresh, strongRefresh], [bestPrevious]).winners.length, 1);

const sameNameDifferentIdentity = [
  candidate("Star Bar", "bar", "node:121", { phone: "253-555-0121" }),
  candidate("Star Bar", "bar", "node:122", { phone: "253-555-0122" }),
];
assert.equal(curateProspects(sameNameDifferentIdentity, []).winners.length, 2,
  "name collisions across two physical businesses aren't merged");

console.log("verify:prospect-curation — all checks passed.");
