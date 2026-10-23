// NHS Lead Finder: independent read-only public OSM availability diagnostic.
// A provider outage must be shown honestly, but must not be confused with
// broken deterministic application tests or block unrelated pull requests.
// Manual strict mode DOES fail unless actual live businesses are retrieved.
// No Supabase credentials, CRM writes, imports, automated outreach or deploys.
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { findBusinesses, completenessScore, websiteHost } from "../lib/lead-finder.ts";
import type { FinderParams } from "../lib/lead-finder.ts";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.NHS_LIVE_PROVIDER_READONLY !== "1") {
  throw new Error("This provider-only diagnostic must run in its isolated GitHub workflow.");
}
const strict = process.env.NHS_PROVIDER_STRICT === "1";
const params: FinderParams = {
  source: "openstreetmap", location: "Puyallup, WA",
  industry: "Restaurants", niches: ["restaurants"],
  radius_mi: 5, result_limit: 5, auto_import: false, top_count: 5,
};
const started = Date.now();

function report(status: "available" | "unavailable", lines: string[]) {
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const summary = [
    "## NHS Lead Finder · real OpenStreetMap connectivity",
    "",
    status === "available"
      ? "**LIVE PROVIDER VERIFIED:** Actual named businesses were returned."
      : "**LIVE PROVIDER NOT VERIFIED:** Public Overpass was unreachable or returned no listings.",
    "",
    "- Search: Puyallup restaurants · 5 miles · up to 5 businesses",
    "- Mode: " + (strict ? "STRICT manual acceptance" : "Non-blocking PR availability diagnostic"),
    "- Duration: " + elapsed + " seconds",
    "- This workflow never connects to Supabase or imports leads",
    "- **Release policy:** A successful real-provider acceptance test is still required; this diagnostic alone cannot authorize merge or deployment.",
    "",
    ...lines,
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, "live_provider_status=" + status + "\n");
  console.log(summary);
}

let businesses: Awaited<ReturnType<typeof findBusinesses>> | undefined;
try {
  businesses = await findBusinesses(params);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // Only the known, bounded Overpass-provider unavailability is non-blocking in
  // regular PR CI. Every unexpected programming error still fails this job.
  if (message !== "Business directory is busy or unreachable. Try again shortly, or use a smaller radius.")
    throw error;
  report("unavailable", ["- Upstream: " + message, "- **Next action:** Test Geoapify with a private QA key in an isolated environment."]);
  if (strict) throw new Error("Strict live-provider acceptance FAILED: Overpass unavailable.");
  console.log("::warning title=External OSM outage::Real OSM search not verified. Release remains blocked.");
}

if (businesses) {
  assert.ok(businesses.length <= params.result_limit, "Provider exceeded the configured result limit");
  assert.equal(new Set(businesses.map(b => b.source_ref)).size, businesses.length, "Duplicate provider source identity");
  for (const business of businesses) {
    assert.match(business.source_ref, /^(node|way|relation):\d+$/, "Valid OSM source reference");
    assert.ok(business.name.trim(), "Every result needs a name");
    if (business.website) assert.match(business.website, /^https?:\/\//, "Normalized listed website URL");
    assert.ok(business.social_profiles.every(p => p.status === "unconfirmed"),
      "Listed social links must remain unverified");
  }
  if (businesses.length === 0) {
    report("unavailable", ["- Provider responded, but returned zero named restaurants.",
      "- **Next action:** Verify categories, query coverage, and alternate provider before release."]);
    if (strict) throw new Error("Strict live-provider acceptance FAILED: zero businesses.");
    console.log("::warning title=No real OSM listings::Live search returned zero named businesses; release gate remains blocked.");
  } else {
    report("available", [
      "- Actual businesses returned: **" + businesses.length + "**",
      "- Website and social fields are **unverified listing claims**, not checked identities.",
      "",
      "| Business | Contact details score | Website listed | OSM reference |",
      "|---|---:|---|---|",
      ...businesses.map(b => "| " + b.name.replace(/[|\r\n]/g, " ").slice(0,100) +
        " | " + completenessScore(b) + "/100 | " + (websiteHost(b.website) ? "Yes" : "No") +
        " | " + b.source_ref + " |"),
    ]);
  }
}
