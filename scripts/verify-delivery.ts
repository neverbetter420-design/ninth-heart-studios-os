// Phase 4 delivery verification: pipeline stages, labels, forward movement.
// No database, no network.
import assert from "node:assert/strict";
import {
  ON_HOLD_STAGE,
  PIPELINE_STAGES,
  isForwardStage,
  milestoneStatusLabel,
  nextStage,
  stageLabel,
} from "../lib/delivery.ts";

// 1. Pipeline has 7 stages in order, discovery first, care last
assert.equal(PIPELINE_STAGES.length, 7, "7 pipeline stages");
assert.equal(PIPELINE_STAGES[0].key, "discovery", "starts at discovery");
assert.equal(PIPELINE_STAGES[6].key, "care", "ends at care");

// 2. Labels are human
assert.equal(stageLabel("discovery"), "Discovery");
assert.equal(stageLabel("care"), "Care Plan");
assert.equal(stageLabel(ON_HOLD_STAGE), "On Hold");
assert.equal(stageLabel("nope"), "nope", "unknown stages pass through, not crash");

// 3. Forward movement
assert.equal(isForwardStage("build"), true);
assert.equal(isForwardStage(ON_HOLD_STAGE), false, "on hold is not forward");
assert.equal(nextStage("discovery"), "content");
assert.equal(nextStage("care"), null, "care is terminal");
assert.equal(nextStage(ON_HOLD_STAGE), null, "on hold has no next stage");

// 4. Milestone labels
assert.equal(milestoneStatusLabel("not_started"), "Not started");
assert.equal(milestoneStatusLabel("complete"), "Complete");

console.log("verify:delivery — all checks passed.");
