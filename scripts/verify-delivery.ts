// Phase 4 delivery verification: pipeline stages, labels, forward movement.
// No database, no network.
import assert from "node:assert/strict";
import { displayProgress, formatProjectDate, projectDueState } from "../lib/project-display.ts";
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

assert.equal(displayProgress(120), 100);
assert.equal(displayProgress(-5), 0);
assert.equal(displayProgress(Number.NaN), 0);
assert.equal(formatProjectDate("2026-10-18"), "Oct 18");
assert.equal(formatProjectDate("2026-02-30"), "No due date");
assert.equal(projectDueState("2026-10-17", new Date("2026-10-18T01:30:00Z")), "soon", "Pacific calendar day still Oct 17");
assert.equal(projectDueState("2026-10-17", new Date("2026-10-18T08:30:00Z")), "overdue", "Pacific calendar day is now Oct 18");
assert.equal(projectDueState("2026-10-24", new Date("2026-10-18T01:30:00Z")), "soon", "7 calendar days ahead");
assert.equal(projectDueState("2026-10-25", new Date("2026-10-18T01:30:00Z")), null);
assert.equal(projectDueState("bad date"), null);

console.log("verify:delivery — all checks passed.");
