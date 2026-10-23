// Explicit opt-in live Geoapify verification for NHS Lead Finder 2.0.
// No database client, no production app connection, no imports, no outreach.
// Keep GEOAPIFY_API_KEY in a private environment variable, never in CLI args.
import assert from "node:assert/strict";
import { findBusinesses, completenessScore, websiteHost } from "../lib/lead-finder.ts";
import type { FinderParams } from "../lib/lead-finder.ts";

if (process.env.NHS_GEOAPIFY_LIVE_READONLY !== "I_APPROVE_READ_ONLY_TEST") {
  throw new Error("Set NHS_GEOAPIFY_LIVE_READONLY=I_APPROVE_READ_ONLY_TEST to run one private-key provider query.");
}
if (!process.env.GEOAPIFY_API_KEY?.trim()) {
  throw new Error("Provide GEOAPIFY_API_KEY via a private environment variable. Do not add it to source code.");
}
if (process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_DB_PASSWORD ||
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("This provider-only smoke test refuses Supabase credentials or config.");
}

const params: FinderParams = {
  source: "geoapify", location: "Puyallup, WA", industry: "Restaurants",
  niches: ["restaurants"], radius_mi: 5, result_limit: 5,
  auto_import: false, top_count: 1,
};
const start = Date.now();
const results = await findBusinesses(params);
assert.ok(results.length > 0, "Geoapify returned no named restaurants within 5 miles of Puyallup.");
assert.ok(results.length <= params.result_limit, "Provider exceeded the search result limit.");
assert.equal(new Set(results.map(r => r.source_ref)).size, results.length, "Duplicate provider identity");
for (const r of results) {
  assert.ok(r.name.trim(), "Unnamed business");
  assert.ok(/^(node|way|relation):\d+$/.test(r.source_ref) || /^geoapify:[a-z0-9._~-]{8,240}$/i.test(r.source_ref), "Invalid source identity");
  assert.ok(r.social_profiles.every(p => ["instagram", "facebook"].includes(p.platform) && p.status === "unconfirmed"), "Social listing claims must remain unverified");
  if (r.website) assert.ok(/^https?:\/\//.test(r.website), "Invalid normalized listed website");
}
console.log(JSON.stringify({
  outcome: "LIVE_GEOAPIFY_READ_ONLY_PASS",
  location: params.location,
  radius_miles: params.radius_mi,
  provider: params.source,
  elapsed_seconds: Number(((Date.now() - start) / 1000).toFixed(1)),
  leads_imported: 0,
  results: results.map(r => ({
    name: r.name, source_ref: r.source_ref, address: r.address,
    website: r.website, listed_website: Boolean(websiteHost(r.website)),
    score: completenessScore(r),
    social_profiles: r.social_profiles.map(p => ({ platform: p.platform, status: p.status })),
  })),
}, null, 2));
