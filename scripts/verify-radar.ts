// Phase 6 radar verification: fit scoring, verdicts, source allowlist.
// No database, no network.
import assert from "node:assert/strict";
import {
  APPROVED_SOURCES,
  FREELANCE_SOURCES,
  estimateGigFit,
  validSourceListingUrl,
  isFreelanceMarketplace,
  FIT_DIMENSIONS,
  fitVerdict,
  isApprovedSource,
  isOpportunityStatus,
  totalFitScore,
} from "../lib/radar.ts";

// 1. 5 fit dimensions with the real keys
assert.equal(FIT_DIMENSIONS.length, 5, "5 fit dimensions");
assert.deepEqual(
  FIT_DIMENSIONS.map((d) => d.key),
  ["project_fit", "budget", "platform", "niche", "clarity"],
  "dimension keys"
);

// 2. Total clamps each dimension to 0–20, sums to 0–100
assert.equal(totalFitScore({ project_fit: 20, budget: 20, platform: 20, niche: 20, clarity: 20 }), 100);
assert.equal(totalFitScore({ budget: 99 }), 20, "over-max dimension clamps");
assert.equal(totalFitScore({ budget: -5 }), 0, "negative clamps to 0");
assert.equal(totalFitScore({}), 0, "empty breakdown scores 0");

// 3. Verdicts match the documented thresholds
assert.equal(fitVerdict(80), "Strong fit — chase it", "80+ = chase");
assert.equal(fitVerdict(79), "Worth a proposal", "79 = worth a proposal");
assert.equal(fitVerdict(60), "Worth a proposal", "60 = worth a proposal");
assert.equal(fitVerdict(59), "Marginal — needs a closer look", "59 = marginal");
assert.equal(fitVerdict(40), "Marginal — needs a closer look", "40 = marginal");
assert.equal(fitVerdict(39), "Probably a pass", "below 40 = pass");

// 4. Source allowlist — no junk sources
assert.ok(isApprovedSource("Upwork"));
assert.ok(isApprovedSource("Referral"));
assert.ok(!isApprovedSource("Cold Email Blast"));
assert.ok(!isApprovedSource(""));
assert.ok(isApprovedSource("Fiverr"));
assert.ok(isApprovedSource("Freelancer"));
assert.equal(APPROVED_SOURCES.length, 7, "existing allowed sources plus two marketplaces");

// 5. Statuses
assert.ok(isOpportunityStatus("new"));
assert.ok(isOpportunityStatus("won"));
assert.ok(!isOpportunityStatus("deleted"));

// 6. Separate freelance marketplace intake, safe attribution and no API connections.
assert.deepEqual(FREELANCE_SOURCES.map(s => s.name), ["Upwork", "Fiverr", "Freelancer"]);
for (const source of FREELANCE_SOURCES) {
  assert.ok(isFreelanceMarketplace(source.name));
  assert.ok(source.href.startsWith("https://"));
  assert.ok(validSourceListingUrl(source.name, source.href));
}
assert.equal(isFreelanceMarketplace("Direct"), false);
assert.equal(validSourceListingUrl("Upwork", "https://evil-upwork.com/jobs/123"), false);
assert.equal(validSourceListingUrl("Upwork", "https://upwork.com.evil.com/jobs/123"), false);
assert.equal(validSourceListingUrl("Freelancer", "https://www.freelancer.com/projects/abc"), true);
assert.equal(validSourceListingUrl("Fiverr", "https://www.fiverr.com/inbox"), true);
assert.equal(validSourceListingUrl("Fiverr", "javascript:alert(1)"), false);
assert.equal(validSourceListingUrl("Upwork", "http://www.upwork.com/jobs/123"), false);
assert.equal(validSourceListingUrl("Upwork", null), true);
assert.equal(validSourceListingUrl("Direct", "https://some-client.com/brief"), true);

// The model-independent fit preview must not claim an official saved score.
const incomplete = estimateGigFit("Website help", "", null);
assert.equal(incomplete.confidence, "insufficient");
assert.equal(incomplete.score, null);
const matching = estimateGigFit("Wix restaurant website redesign",
  "We need a mobile-friendly reservation website, five pages, a menu and a launch timeline in three weeks.", 1200);
assert.equal(matching.confidence, "preliminary");
assert.ok((matching.score ?? 0) >= 80, "appropriate Wix project and budget ranks highly");
assert.equal(matching.breakdown?.platform, 20);
const nonFit = estimateGigFit("Build our Flutter mobile app",
  "Need Flutter engineers to ship a complex native app for logistics with a custom backend and ongoing monthly releases.", 300);
assert.ok((nonFit.score ?? 100) < (matching.score ?? 0), "unsupported mobile work ranks lower");
assert.ok(nonFit.questions.some(x => x.includes("technology")));
const unclear = estimateGigFit("Website redesign request",
  "We require a redesign of some pages but are still exploring the timeline and have not defined a firm budget.", null);
assert.ok(unclear.questions.some(x => x.includes("budget")));

console.log("verify:radar — all checks passed.");
