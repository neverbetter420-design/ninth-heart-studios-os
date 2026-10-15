// Prospect Scanner verification: scoring, badges, drafts, URL normalization.
// No database, no network.
import assert from "node:assert/strict";
import {
  NICHES,
  normalizeWebsite,
  scoreSignals,
  signalBadges,
  draftOutreach,
  type WebsiteSignals,
} from "../lib/prospect-scan.ts";

const base: WebsiteSignals = {
  has_website: true,
  reachable: true,
  https: true,
  mobile_viewport: true,
  builder: null,
  title_ok: true,
  description_ok: true,
  stale_copyright: false,
  copyright_year: 2026,
  load_ms: 800,
  page_bytes: 40000,
};

// 1. Niches cover her client types
assert.ok("restaurants" in NICHES && "salons" in NICHES && "contractors" in NICHES, "niches present");
for (const [k, v] of Object.entries(NICHES)) {
  assert.ok(v.label && v.overpass.length > 0, `niche ${k} has label + filters`);
}

// 2. URL normalization
assert.equal(normalizeWebsite(null), null);
assert.equal(normalizeWebsite("  "), null);
assert.equal(normalizeWebsite("example.com"), "https://example.com/");
assert.equal(normalizeWebsite("http://example.com"), "http://example.com/");

// 3. Unsafe inputs cannot cause backend fetches to local services.
for (const unsafe of [
  "http://127.0.0.1/",
  "http://192.168.0.1/",
  "http://[::1]/",
  "http://localhost/",
  "http://printer.local/",
  "http://127.0.0.1.nip.io/",
  "https://user:password@example.com/",
  "https://example.com:8080/",
  "file:///etc/passwd",
]) assert.equal(normalizeWebsite(unsafe), null, `blocked: ${unsafe}`);

// 4. Scoring: no website scores high, clean site scores low
assert.equal(scoreSignals({ ...base, has_website: false }), 35, "unverified absence → 35");
assert.equal(scoreSignals({ ...base, reachable: false }), 25, "inconclusive check → 25");
const clean = scoreSignals(base);
assert.ok(clean < 20, `clean site scores low (got ${clean})`);
const rough = scoreSignals({
  ...base,
  https: false,
  mobile_viewport: false,
  builder: "Wix",
  title_ok: false,
  stale_copyright: true,
});
assert.ok(rough > clean, "rough site outscores clean site");
assert.ok(scoreSignals({ ...base, https: false, mobile_viewport: false, builder: "Wix", title_ok: false, description_ok: false, stale_copyright: true, load_ms: 5000 }) <= 100, "capped at 100");

// 4. Badges reflect signals
const noSite = signalBadges({ ...base, has_website: false });
assert.equal(noSite.length, 1);
assert.equal(noSite[0].label, "No website listed (verify)");
const bad = signalBadges({ ...base, https: false, mobile_viewport: false, builder: "Wix" });
assert.ok(bad.some((b) => b.label === "No HTTPS"), "https badge");
assert.ok(bad.some((b) => b.label === "Viewport tag missing"), "viewport badge");
assert.ok(bad.some((b) => b.label === "Built on Wix"), "builder badge");

// 5. Drafts: personalized, her voice, never empty
const draft = draftOutreach(
  { business_name: "Copper Kettle", category: "restaurant", address: null, phone: null, website: "http://x.com", areaLabel: "Puyallup, WA" },
  { ...base, mobile_viewport: false }
);
assert.ok(draft.subject.includes("Copper Kettle"), "subject names the business");
assert.ok(draft.body.includes("Hailey"), "signed by Hailey");
assert.ok(draft.body.includes("15-minute consultation"), "has CTA");
assert.ok(draft.body.toLowerCase().includes("mobile"), "references the finding");
const noSiteDraft = draftOutreach(
  { business_name: "No Site Diner", category: "restaurant", address: null, phone: null, website: null, areaLabel: "Puyallup, WA" },
  { ...base, has_website: false }
);
assert.ok(noSiteDraft.body.includes("couldn't find a website linked"), "no-website finding");

console.log("verify:scanner — all checks passed.");
