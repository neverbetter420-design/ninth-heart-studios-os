// Phase 7 verification: deterministic Muse engine checks with fixtures.
// No database, no network — pure reasoning over synthetic records.
import assert from "node:assert/strict";
import { rankLeads, type FlowkeepLead, type RankedLead } from "../lib/flowkeep.ts";
import {
  buildDraftFromTarget,
  draftFollowUp,
  draftProposal,
  explainFitScore,
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


// 10. Fit explainer: strengths and concerns narrate the breakdown
const fitExp = explainFitScore({
  opportunityId: "opp-1",
  score: 72,
  fitNotes: "Owner seems motivated, replied fast.",
  breakdown: { project_fit: 16, budget: 6, platform: 18, niche: 14, clarity: 12 },
});
assert.match(fitExp.verdict, /proposal/i, "72 should read as proposal-worthy");
assert.ok(fitExp.strengths.some((s) => /Platform 18\/20/.test(s)), "Top dimension must be called out as a strength");
assert.ok(fitExp.concerns.some((c) => /Budget 6\/20/.test(c)), "Weak dimension must be called out as a concern");
assert.match(fitExp.notes ?? "", /motivated/, "Human fit notes must survive into the explanation");
assert.ok(fitExp.nudge, "A mid-range score should carry a nudge");

// 11. Fit explainer: unscored dimensions don't invent praise
const thinExp = explainFitScore({
  opportunityId: "opp-2",
  score: 30,
  fitNotes: null,
  breakdown: {},
});
assert.equal(thinExp.strengths.length, 0, "No breakdown means no invented strengths");
assert.equal(thinExp.concerns.length, 0, "No breakdown means no invented concerns");
assert.match(thinExp.nudge ?? "", /pass/i, "Low score without breakdown should advise passing");

console.log("verify:muse — all checks passed.");
