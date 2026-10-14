// Phase 6 radar verification: fit scoring, verdicts, source allowlist.
// No database, no network.
import assert from "node:assert/strict";
import {
  APPROVED_SOURCES,
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
assert.equal(APPROVED_SOURCES.length, 5, "5 approved sources");

// 5. Statuses
assert.ok(isOpportunityStatus("new"));
assert.ok(isOpportunityStatus("won"));
assert.ok(!isOpportunityStatus("deleted"));

console.log("verify:radar — all checks passed.");
