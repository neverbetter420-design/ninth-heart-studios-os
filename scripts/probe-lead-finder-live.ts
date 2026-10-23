// Read-only live smoke test for the NHS Lead Finder business provider.
// Runs the actual production discovery functions against a public provider.
// Does not connect to Supabase or write leads; no secrets, payment, or outreach.
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { findBusinesses, completenessScore, websiteHost } from "../lib/lead-finder.ts";
import type { FinderParams } from "../lib/lead-finder.ts";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.NHS_LIVE_PROVIDER_READONLY !== "1") {
  throw new Error("Read-only provider smoke test must run in the isolated GitHub Actions job.");
}
const params: FinderParams = {
  source: "openstreetmap",
  location: "Puyallup, WA",
  industry: "Restaurants",
  niches: ["restaurants"],
  radius_mi: 5,
  result_limit: 5,
  auto_import: false,
  top_count: 5,
};
const start = Date.now();
let results: Awaited<ReturnType<typeof findBusinesses>>;
try {
  results = await findBusinesses(params);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  const summary = [
    "## NHS Lead Finder 2.0 — real provider smoke test",
    "",
    "**Result: FAILED (provider connectivity or response).**",
    "",
    "- Source: OpenStreetMap Overpass, using the draft app's actual discovery code",
    "- Search: Puyallup, WA · Restaurants · 5 miles · up to 5",
    "- Safety: read-only; no Supabase, no CRM import, no outreach",
    "- Failure: " + reason.replace(/[|\r\n]/g, " ").slice(0, 250),
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  throw new Error("Real OSM provider smoke test failed: " + reason);
}
assert.ok(results.length > 0, "Real provider returned no named businesses within this search.");
assert.ok(results.length <= 5, "Search exceeded configured result limit.");
assert.equal(new Set(results.map(r => r.source_ref)).size, results.length, "Duplicate provider source refs");
for (const b of results) {
  assert.match(b.source_ref, /^(node|way|relation):\d+$/, "Actual OSM identity");
  assert.ok(b.name.trim(), "Business name is present");
  if (b.website) assert.ok(b.website.startsWith("https://") || b.website.startsWith("http://"), "Normalized public website");
}
const display = results.map((b) => ({
  business: b.name,
  category: b.category,
  address: b.address,
  website: b.website,
  website_listed: Boolean(websiteHost(b.website)),
  phone_listed: Boolean(b.phone),
  social_profiles: b.social_profiles.map(x => ({ platform: x.platform, status: x.status })),
  completeness_score: completenessScore(b),
  osm_reference: b.source_ref,
}));
const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(JSON.stringify({ search: params, elapsed_seconds: Number(elapsed), results: display }, null, 2));
const summary = [
  "## NHS Lead Finder 2.0 — real provider smoke test",
  "",
  "**Result: PASSED (live Overpass data).**",
  "",
  "- Search: Puyallup, WA · Restaurants · 5 miles · max 5",
  "- Provider: public OpenStreetMap Overpass (actual draft scanner code)",
  "- Returned: " + results.length + " named listings in " + elapsed + " seconds",
  "- Import mode: OFF; no Supabase connection, CRM writes, or outreach",
  "- Website and social links are listing claims, **not independently identity-verified**",
  "",
  "| Business | Contact score | Website listed | Social profiles | OSM source |",
  "|---|---:|---|---|---|",
  ...results.map(b => {
    const clean = (v: string) => v.replace(/[|\r\n]/g, " ").slice(0, 95);
    return "| " + clean(b.name) + " | " + completenessScore(b) +
      "/100 | " + (websiteHost(b.website) ? "Yes" : "No") +
      " | " + b.social_profiles.map(p => p.platform + " (unconfirmed)").join(", ") +
      " | " + b.source_ref + " |";
  }),
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
