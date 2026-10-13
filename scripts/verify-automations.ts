// Phase 8 verification: automation engine checks with fixtures.
// No database, no network — pure logic over synthetic records.
import assert from "node:assert/strict";
import {
  runApprovalNudge,
  runProjectRiskScan,
  runSlaWatch,
  runStaleLeadDigest,
} from "../lib/automations.ts";
import type { FlowkeepLead } from "../lib/flowkeep.ts";

const now = new Date("2026-10-12T19:00:00.000Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const baseLead: FlowkeepLead = {
  id: "base",
  business_name: "Base Bar",
  acquisition_type: "outbound",
  momentum_state: "Waiting on Them",
  status: "contacted",
  created_at: daysAgo(10),
  updated_at: daysAgo(2),
  last_activity_at: daysAgo(2),
};

// 1. Stale digest flags quiet leads, stays silent when warm
const staleResult = runStaleLeadDigest(
  [
    { ...baseLead, id: "quiet", business_name: "Quiet Cafe", last_activity_at: daysAgo(12), updated_at: daysAgo(12) },
    { ...baseLead, id: "fresh", business_name: "Fresh Diner", last_activity_at: daysAgo(1), updated_at: daysAgo(1) },
  ],
  7,
  now,
);
assert.equal(staleResult.notifications.length, 1, "One digest notification for the quiet lead");
assert.match(staleResult.notifications[0].title, /1 lead going quiet/, "Digest names the count");
assert.match(staleResult.notifications[0].body, /Quiet Cafe/, "Digest names the business");

const warmResult = runStaleLeadDigest(
  [{ ...baseLead, last_activity_at: daysAgo(1), updated_at: daysAgo(1) }],
  7,
  now,
);
assert.equal(warmResult.notifications.length, 0, "No notification when pipeline is warm");

// 2. SLA watch catches breaches
const slaResult = runSlaWatch(
  [
    {
      ...baseLead,
      id: "breach",
      business_name: "Breach Bistro",
      acquisition_type: "inbound",
      momentum_state: "New Inbound",
      original_inquiry_at: daysAgo(6),
    },
  ],
  now,
);
assert.ok(
  slaResult.notifications.some((n) => /breached/i.test(n.title)),
  "Breached SLA must raise an action notification",
);

// 3. Risk scan flags critical projects, stays silent when healthy
const riskResult = runProjectRiskScan(
  [
    {
      id: "risky",
      name: "Risky Build",
      status: "build",
      dueDate: daysAgo(3),
      lastActivityAt: daysAgo(20),
      milestones: [{ title: "Design", status: "in_progress", dueDate: daysAgo(5) }],
      tasks: [],
      pendingApprovals: 0,
    },
  ],
  now,
);
assert.ok(
  riskResult.notifications.some((n) => /Risky Build/.test(n.title)),
  "Overdue project must raise a risk notification",
);

const calmResult = runProjectRiskScan(
  [
    {
      id: "calm",
      name: "Calm Build",
      status: "build",
      dueDate: null,
      lastActivityAt: daysAgo(1),
      milestones: [],
      tasks: [],
      pendingApprovals: 0,
    },
  ],
  now,
);
assert.equal(calmResult.notifications.length, 0, "Healthy project raises nothing");

// 4. Approval nudge respects the threshold
const nudgeResult = runApprovalNudge(
  [
    {
      id: "a1",
      title: "Homepage mockup",
      project_id: "p1",
      project_name: "Diner Site",
      requested_at: daysAgo(5),
    },
    {
      id: "a2",
      title: "Menu page",
      project_id: "p1",
      project_name: "Diner Site",
      requested_at: daysAgo(1),
    },
  ],
  3,
  now,
);
assert.equal(nudgeResult.notifications.length, 1, "One nudge for the stale approval");
assert.match(nudgeResult.notifications[0].body, /Homepage mockup/, "Nudge names the stale approval");
assert.doesNotMatch(nudgeResult.notifications[0].body, /Menu page/, "Fresh approval is not nagged");

console.log("verify:automations — all checks passed.");
