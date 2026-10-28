// Pure, read-only category challenger ranking tests. No production DB calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildChallengerShortlists, parseShortlistDepth, SHORTLIST_DEPTHS, type SavedChallenger } from "../lib/prospect-shortlists.ts";
import type { WebsiteSignals } from "../lib/prospect-scan.ts";

const missing: WebsiteSignals = {
  has_website: false, reachable: false, https: false, mobile_viewport: false,
  builder: null, title_ok: false, description_ok: false, stale_copyright: false,
  copyright_year: null, load_ms: null, page_bytes: null,
};
const reachable: WebsiteSignals = { ...missing, has_website: true, reachable: true };
const p = (id: string, name: string, category: string, overrides: Partial<SavedChallenger> = {}): SavedChallenger => ({
  id, source_ref: "node:" + id.replace(/\D/g, ""), business_name: name,
  category, address: "Main St, WA", phone: null, website: null, signals: missing,
  opportunity_score: 10, outreach_status: "none", status: "new", ...overrides,
});
const rows = [
  p("100", "Restaurant with phone", "restaurant", { phone: "253-555-0100", opportunity_score: 65 }),
  p("200", "Restaurant with live website", "catering.restaurant", {
    website: "https://restaurant.example.com", signals: reachable, opportunity_score: 85,
  }),
  p("300", "Restaurant with no contact", "restaurant", { phone: null, website: null }),
  p("400", "Bar with phone", "pub", { phone: "253-555-0400", opportunity_score: 40 }),
  p("500", "Salon with phone", "service.beauty.hairdresser", { phone: "253-555-0500", opportunity_score: 60 }),
  p("600", "Already contacted", "bar", { phone: "253-555-0600", outreach_status: "sent" }),
  p("700", "Already promoted", "hairdresser", { phone: "253-555-0700", status: "promoted" }),
  p("800", "Already drafted", "bar", { phone: "253-555-0800", outreach_draft: "draft" }),
  p("900", "Archived", "restaurant", { phone: "253-555-0900", status: "archived" }),
];
const groups = buildChallengerShortlists(rows, 5);
assert.deepEqual(groups.map(g => g.category), ["restaurants", "bars", "salons"]);
const r = groups.find(g => g.category === "restaurants")!;
assert.equal(r.considered, 3);
assert.equal(r.qualified, 2, "uncontactable listing excluded from recommendations");
assert.ok(r.top[0].quality >= r.top[1].quality);
assert.deepEqual(r.top.map(x=>x.rank), [1, 2]);
assert.equal(groups.find(g => g.category === "bars")?.qualified, 1,
  "sent and drafted remain protected even if their score is higher");
assert.equal(groups.find(g => g.category === "salons")?.qualified, 1,
  "promoted opportunities are excluded");
const sameName = buildChallengerShortlists([
  p("100", "Same Brand", "pub", { phone: "253-555-0100" }),
  p("101", "Same Brand", "bar", { phone: "253-555-0101" }),
], 5);
assert.equal(sameName[0].qualified, 2, "same name at distinct OSM identities is not a duplicate");
const duplicate = buildChallengerShortlists([
  p("100", "Same Ref", "bar", { phone: "253-555-0100" }),
  p("101", "Same Ref Again", "pub", { phone: "253-555-0101", source_ref: "node:100" }),
], 5);
assert.equal(duplicate[0].qualified, 1, "same stable identity deduplicated");
const bounded = buildChallengerShortlists(Array.from({ length: 30 }, (_, i) =>
  p(String(1000 + i), "Bar " + i, "bar", { phone: "253-555-0000" })), 99);
assert.equal(bounded[0].top.length, 20, "bound maximum UI list to 20");
assert.equal(bounded[0].qualified, 30, "show qualified count, not only first 20");
assert.equal(rows.length, 9, "ranking does not mutate input collection");
// User-visible shortlist length is a view preference, not a new scan or a DB write.
assert.deepEqual(SHORTLIST_DEPTHS, [3,10,20]);
for (const [input, expected] of [
  [undefined, 3], [null, 3], [["10"], 3], [["20"], 3], [10, 3], [20, 3],
  ["3", 3], ["10 ", 3], ["01", 3], ["999", 3], ["-1", 3], ["<script>", 3],
] as const) assert.equal(parseShortlistDepth(input), expected ?? 3);
assert.equal(parseShortlistDepth("3"), 3);
assert.equal(parseShortlistDepth("10"), 10);
assert.equal(parseShortlistDepth("20"), 20);
const depthSource = Array.from({ length: 25 }, (_, i) =>
  p(String(2000 + i), "Qualified Bar " + i, "bar", {
    phone: "253-555-0100", opportunity_score: 40 + i,
  }));
const top3 = buildChallengerShortlists(depthSource, parseShortlistDepth("3"))[0].top;
const top10 = buildChallengerShortlists(depthSource, parseShortlistDepth("10"))[0].top;
const top20 = buildChallengerShortlists(depthSource, parseShortlistDepth("20"))[0].top;
assert.deepEqual([top3.length, top10.length, top20.length], [3,10,20]);
assert.deepEqual(top10.slice(0, 3), top3);
assert.deepEqual(top20.slice(0, 10), top10);
assert.deepEqual(top20.map(row => row.rank), Array.from({length:20}, (_,i)=>i+1));
assert.equal(depthSource.length, 25, "display-only changes never mutate saved source records");
const uiSource = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(uiSource, /parseShortlistDepth\(shortlist\)/);
assert.match(uiSource, /parseShortlistDepth\(changes.shortlist \?\? shortlist\)/);
assert.match(uiSource, /if \(depth !== 3\) queryParams.set\("shortlist", String\(depth\)\)/);
assert.match(uiSource, /aria-label="Best-fit shortlist length"/);
assert.match(uiSource, /aria-current=\{depth === shortlistDepth \? "page" : undefined\}/);
assert.match(uiSource, /SHORTLIST_DEPTHS.map\(depth =>/);
assert.match(uiSource, /id="qualified-shortlists"/);
assert.match(uiSource, /\.eq\("status", "new"\)/);

console.log("verify:prospect-shortlists — all checks passed.");
