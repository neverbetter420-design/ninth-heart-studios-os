// Phase 7 verification: deterministic Muse engine checks with fixtures.
// No database, no network — pure reasoning over synthetic records.
import assert from "node:assert/strict";
import { rankLeads, type FlowkeepLead, type RankedLead } from "../lib/flowkeep.ts";
import {
  buildDraftFromTarget,
  draftFollowUp,
  draftProposal,
  explainPriority,
  findStaleLeads,
  recommendNextAction,
  summarizeProjectRisk,
} from "../lib/muse.ts";

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

function ranked(overrides: Partial<FlowkeepLead>): RankedLead {
  return rankLeads([{ ...baseLead, ...overrides }])[0];
}

// 1. Explainer: SLA breach surfaces first
const breached = ranked({
  id: "breached",
  business_name: "Breached Cafe",
  acquisition_type: "inbound",
  momentum_state: "New Inbound",
  original_inquiry_at: daysAgo(6),
});
const breachedReasons = explainPriority(breached, now).reasons.join(" ");
assert.match(breachedReasons, /SLA breached/i, "Overdue inbound must explain the SLA breach");

// 2. Explainer: human reply outranks busywork
const replied = ranked({
  id: "replied",
  business_name: "Reply Diner",
  last_outcome: "Received Reply",
  last_reply_at: daysAgo(1),
  last_activity_at: daysAgo(1),
  next_action_kind: "reply",
});
assert.match(
  explainPriority(replied, now).reasons.join(" "),
  /waiting on a human/i,
  "A received reply must be explained as waiting on a human",
);

// 3. Stale detection
const stale = findStaleLeads(
  [
    ranked({ id: "quiet", business_name: "Quiet Saloon", last_activity_at: daysAgo(12), updated_at: daysAgo(12) }),
    ranked({ id: "fresh", business_name: "Fresh Bistro", last_activity_at: daysAgo(1), updated_at: daysAgo(1) }),
  ],
  now,
);
assert.equal(stale.length, 1, "Only the quiet lead should be stale");
assert.equal(stale[0].leadId, "quiet");

// 4. Project risk: overdue milestone escalates
const risk = summarizeProjectRisk(
  {
    id: "p1",
    name: "Risky Build",
    status: "build",
    dueDate: daysAgo(3),
    lastActivityAt: daysAgo(1),
    milestones: [{ title: "Design sign-off", status: "in_progress", dueDate: daysAgo(5) }],
    tasks: [{ title: "Homepage hero", status: "in_progress", dueDate: daysAgo(2) }],
    pendingApprovals: 1,
  },
  now,
);
assert.ok(["high", "critical"].includes(risk.level), "Overdue milestone + passed due date must escalate risk");
assert.ok(risk.factors.length >= 2, "Risk must list concrete factors");

// 5. Recommendation: critical delivery risk beats pipeline
const reco = recommendNextAction({
  topLead: ranked({ id: "lead1", business_name: "Lead One" }),
  topRisk: { ...risk, level: "critical" },
  staleCount: 0,
});
assert.match(reco.href, /\/projects\/p1/, "Critical project risk must win the recommendation");

// 6. Recommendation: breached SLA beats a normal lead
const reco2 = recommendNextAction({
  topLead: breached,
  staleCount: 0,
});
assert.match(reco2.href, /\/leads\/breached/, "Breached SLA lead must be the recommendation");

// 7. Drafts: follow-up uses first name, never sends
const followUp = draftFollowUp(
  { ...baseLead, business_name: "Nudge Bar", contact_name: "Dana Rivera" },
  "nudge",
);
assert.match(followUp.subject, /Nudge Bar/, "Draft subject names the business");
assert.match(followUp.body, /^Hi Dana,/m, "Draft greets by first name");
assert.match(followUp.body, /\bI\b/, "Drafts speak as Hailey (I), not a team (we)");
assert.ok(!/we('|’)ll|our team/i.test(followUp.body), "Drafts must not invent a team");

// 8. Proposal draft carries the pricing placeholder, not a binding quote
const proposal = draftProposal({ title: "Salon Site" });
assert.match(proposal.body, /\[Confirm package \+ price before sending/, "Proposal must flag pricing as unconfirmed");

// 9. Draft target routing
const built = buildDraftFromTarget(
  { type: "project", project: { name: "Portal Build", clientName: "Sam Carter" } },
  "check_in",
);
assert.equal(built.kind, "check_in");
assert.match(built.body, /^Hi Sam,/m, "Project check-in greets the client by first name");

console.log("verify:muse — all checks passed.");
