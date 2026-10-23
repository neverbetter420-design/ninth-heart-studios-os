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
  // A single lightweight request per independent public mirror helps distinguish
  // shared-cloud egress blocking from an overloaded main Overpass endpoint.
  // This diagnostic never substitutes results into the app or marks the smoke
  // test successful: the actual draft provider function must still work.
  const query = '[out:json][timeout:8];node["amenity"="restaurant"](around:1609,47.18538,-122.2929);out center 2;';
  const alternatives = [
    ["OSM DE GET", "https://overpass-api.de/api/interpreter"],
    ["Private.coffee GET", "https://overpass.private.coffee/api/interpreter"],
    ["FOSSGIS GET", "https://lz4.overpass-api.de/api/interpreter"],
  ] as const;
  const diagnostics = await Promise.all(alternatives.map(async ([label, endpoint]) => {
    try {
      const response = await fetch(endpoint + "?data=" + encodeURIComponent(query), {
        method: "GET",
        headers: { "User-Agent": "NinthHeartStudios-OS/1.0 (contact: admin@ninthheartstudios.com)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return label + ": HTTP " + response.status;
      const raw = await response.text();
      if (raw.length > 100000) return label + ": unexpectedly large diagnostic response";
      const parsed = JSON.parse(raw);
      return label + ": HTTP 200, " + (Array.isArray(parsed.elements) ? parsed.elements.length + " OSM objects" : "non-OSM JSON");
    } catch (e) {
      return label + ": " + (e instanceof Error ? e.message : String(e)).slice(0, 100);
    }
  }));
  console.log("Independent provider diagnostics (no app or database writes):", diagnostics);
  const summary = [
    "## NHS Lead Finder 2.0 — real provider smoke test",
    "",
    "**Result: FAILED (provider connectivity or response).**",
    "",
    "- Source: OpenStreetMap Overpass, using the draft app's actual discovery code",
    "- Search: Puyallup, WA · Restaurants · 5 miles · up to 5",
    "- Safety: read-only; no Supabase, no CRM import, no outreach",
    "- Failure: " + reason.replace(/[|\r\n]/g, " ").slice(0, 250),
    ...diagnostics.map(d => "- Optional alternate endpoint: " + d.replace(/[|\r\n]/g, " ")),
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
