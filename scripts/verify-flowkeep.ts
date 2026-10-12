import assert from "node:assert/strict";
import { deriveNewLead, getSlaState, inboundSlaDueAt, outcomePatch, rankLeads, type FlowkeepLead } from "../lib/flowkeep.ts";

const mondayMorning = new Date("2026-10-12T17:00:00.000Z");
const due = inboundSlaDueAt(mondayMorning);
assert.equal(due.toISOString(), "2026-10-14T03:00:00.000Z", "Monday inbound should be due Tuesday 8 PM Pacific");

const fridayLate = new Date("2026-10-17T04:30:00.000Z");
const fridayDue = inboundSlaDueAt(fridayLate);
assert.equal(fridayDue.toISOString(), "2026-10-21T03:00:00.000Z", "After-cutoff Friday inbound should be due Tuesday 8 PM Pacific");

const inbound = deriveNewLead({ acquisitionType: "inbound", hasContactMethod: true, createdAt: mondayMorning });
assert.equal(inbound.momentum_state, "New Inbound");
assert.equal(inbound.next_action, "Respond to new lead");

const outbound = deriveNewLead({ acquisitionType: "outbound", hasContactMethod: false, createdAt: mondayMorning });
assert.equal(outbound.next_action, "Find contact method");

const replied = outcomePatch("Received Reply", mondayMorning);
assert.equal(replied.next_action_kind, "reply");
assert.equal(replied.momentum_state, "Waiting on Me");

const sent = outcomePatch("Sent Email", mondayMorning);
assert.equal(sent.last_outreach_at, mondayMorning.toISOString(), "Outbound response should record the SLA-stopping outreach timestamp");

const metSlaLead: FlowkeepLead = {
  id: "sla-met",
  business_name: "SLA Met",
  acquisition_type: "inbound",
  momentum_state: "Waiting on Them",
  status: "contacted",
  next_action_kind: "follow_up",
  original_inquiry_at: new Date("2026-10-12T16:00:00.000Z").toISOString(),
  last_outreach_at: mondayMorning.toISOString(),
  created_at: new Date("2026-10-12T16:00:00.000Z").toISOString(),
  updated_at: mondayMorning.toISOString(),
};
assert.equal(getSlaState(metSlaLead, mondayMorning).status, "met", "First response should stop the inbound SLA clock");

const base: Omit<FlowkeepLead, "id" | "business_name" | "momentum_state" | "next_action_kind"> = {
  acquisition_type: "outbound",
  status: "prospect",
  created_at: mondayMorning.toISOString(),
  updated_at: mondayMorning.toISOString(),
};

const ranked = rankLeads([
  { ...base, id: "research", business_name: "Research", momentum_state: "Waiting on Me", next_action_kind: "research" },
  { ...base, id: "inbound", business_name: "Inbound", acquisition_type: "inbound", momentum_state: "New Inbound", next_action_kind: "new_inbound", original_inquiry_at: mondayMorning.toISOString() },
  { ...base, id: "consult", business_name: "Consult", momentum_state: "Scheduled Consultation", next_action_kind: "consultation" },
  { ...base, id: "reply", business_name: "Reply", momentum_state: "Waiting on Me", next_action_kind: "reply" },
], mondayMorning);

assert.deepEqual(ranked.map((lead) => lead.id), ["reply", "consult", "inbound", "research"], "Ranking order must stay deterministic");

const staleInboundRanking = rankLeads([
  { ...base, id: "consult-fresh", business_name: "Fresh Consult", momentum_state: "Scheduled Consultation", next_action_kind: "consultation", last_activity_at: mondayMorning.toISOString() },
  { ...base, id: "inbound-stale", business_name: "Stale Inbound", acquisition_type: "inbound", momentum_state: "New Inbound", next_action_kind: "new_inbound", original_inquiry_at: "2026-08-01T17:00:00.000Z", last_activity_at: "2026-08-01T17:00:00.000Z" },
], mondayMorning);
assert.deepEqual(staleInboundRanking.map((lead) => lead.id), ["consult-fresh", "inbound-stale"], "Tie-breakers must never let new inbound outrank consultation prep");

console.log("Flowkeep verification passed: SLA, capture, outcomes, and priority order are deterministic.");
