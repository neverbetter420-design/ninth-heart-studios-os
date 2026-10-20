// Phase 7 — Muse: the intelligence layer.
//
// Deterministic studio reasoning over live data. Muse explains why an action is
// prioritized, summarizes project risk, surfaces stale leads, recommends the
// next studio action, and drafts follow-ups and proposals.
//
// This reasoning module does not dispatch messages. Draft generation is
// separate from saving a draft and from the explicit per-recipient Gmail send
// action in the Muse workspace.

import type { FlowkeepLead, RankedLead } from "./flowkeep";
import { FIT_DIMENSIONS, fitVerdict, type FitBreakdown, type FitDimensionKey } from "./radar.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MuseDraftKind = "follow_up" | "proposal" | "check_in";
export type MuseDraftStatus = "draft" | "archived";

export type PriorityExplanation = {
  leadId: string;
  businessName: string;
  actionTitle: string;
  priorityLabel: RankedLead["priorityLabel"];
  reasons: string[];
};

export type ProjectRiskInput = {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  lastActivityAt: string | null;
  milestones: { title: string; status: string; dueDate: string | null }[];
  tasks: { title: string; status: string; dueDate: string | null }[];
  pendingApprovals: number;
};

export type ProjectRiskLevel = "low" | "watch" | "high" | "critical";

export type ProjectRisk = {
  projectId: string;
  name: string;
  level: ProjectRiskLevel;
  factors: string[];
};

export type StaleLead = {
  leadId: string;
  businessName: string;
  daysQuiet: number;
  reason: string;
};

export type StudioRecommendation = {
  title: string;
  detail: string;
  href: string;
  why: string;
};

export type GeneratedDraft = {
  kind: MuseDraftKind;
  subject: string;
  body: string;
};

export type DraftTarget =
  | { type: "lead"; lead: FlowkeepLead }
  | { type: "opportunity"; opportunity: { title: string; source?: string | null; url?: string | null } }
  | { type: "project"; project: { name: string; clientName?: string | null } };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function daysBetween(from: string | null | undefined, now: Date): number | null {
  if (!from) return null;
  const then = new Date(from).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "no date set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "no date set";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ago(days: number | null): string {
  if (days === null) return "a while";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function isOverdueDue(dueDate: string | null | undefined, now: Date): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).getTime();
  return !Number.isNaN(due) && due < now.getTime();
}

// ---------------------------------------------------------------------------
// 1. Explain why a lead/action is prioritized
// ---------------------------------------------------------------------------

export function explainPriority(lead: RankedLead, now = new Date()): PriorityExplanation {
  const reasons: string[] = [];

  if (lead.sla.applicable && lead.sla.status === "overdue") {
    reasons.push(`Inbound SLA breached — a reply was due ${shortDate(lead.sla.dueAt)}.`);
  } else if (lead.sla.applicable && lead.sla.status === "due_soon") {
    reasons.push(`Inbound SLA due ${shortDate(lead.sla.dueAt)} — the clock is running.`);
  }

  if (lead.last_outcome === "Received Reply" || lead.next_action_kind === "reply") {
    const quiet = daysBetween(lead.last_reply_at ?? lead.last_activity_at, now);
    reasons.push(`They replied ${ago(quiet)} and are waiting on a human. Humans outrank busywork.`);
  }

  if (lead.momentum_state === "New Inbound") {
    reasons.push("Fresh inbound — first response speed sets the tone for the whole deal.");
  }
  if (lead.momentum_state === "Prepare for Consultation" || lead.momentum_state === "Scheduled Consultation") {
    const when = lead.consultation_at ? shortDate(lead.consultation_at) : "soon";
    reasons.push(`Consultation ${when} — showing up prepared is the job.`);
  }
  if (lead.next_action_kind === "follow_up") {
    const quiet = daysBetween(lead.last_outreach_at ?? lead.last_activity_at, now);
    reasons.push(`Last outreach was ${ago(quiet)} — this one is cooling off.`);
  }
  if (lead.next_action_kind === "first_outreach") {
    reasons.push("Never contacted — first touch is still on the table.");
  }

  if (typeof lead.score === "number" && lead.score >= 70) {
    reasons.push(`Fit score ${lead.score} — this one looks like a real client, not a tire-kicker.`);
  }

  if (reasons.length === 0) {
    reasons.push("Ranked by momentum, recency, and fit — nothing alarming, just next in line.");
  }

  return {
    leadId: lead.id,
    businessName: lead.business_name,
    actionTitle: lead.actionTitle,
    priorityLabel: lead.priorityLabel,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// 2. Summarize project risk
// ---------------------------------------------------------------------------

export function summarizeProjectRisk(input: ProjectRiskInput, now = new Date()): ProjectRisk {
  const factors: string[] = [];
  let level: ProjectRiskLevel = "low";

  const overdueMilestones = input.milestones.filter(
    (m) => m.status !== "complete" && isOverdueDue(m.dueDate, now),
  );
  const overdueTasks = input.tasks.filter(
    (t) => t.status !== "complete" && t.status !== "done" && isOverdueDue(t.dueDate, now),
  );

  if (overdueMilestones.length > 0) {
    factors.push(
      `${overdueMilestones.length} overdue milestone${overdueMilestones.length === 1 ? "" : "s"}: ${overdueMilestones
        .slice(0, 2)
        .map((m) => m.title)
        .join(", ")}${overdueMilestones.length > 2 ? "…" : ""}.`,
    );
    level = "high";
  }
  if (overdueTasks.length > 0) {
    factors.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"} blocking progress.`);
    if (level === "low") level = "watch";
  }
  if (input.pendingApprovals > 0) {
    factors.push(
      `${input.pendingApprovals} approval${input.pendingApprovals === 1 ? "" : "s"} waiting on the client — the ball is in their court, but the deadline doesn't care.`,
    );
    if (level === "low") level = "watch";
  }
  if (isOverdueDue(input.dueDate, now) && !["care", "launch"].includes(input.status)) {
    factors.push(`Target date ${shortDate(input.dueDate)} has passed and the project isn't at launch yet.`);
    level = "high";
  }
  const quiet = daysBetween(input.lastActivityAt, now);
  if (quiet !== null && quiet >= 14 && !["care", "on_hold"].includes(input.status)) {
    factors.push(`No recorded activity in ${quiet} days — stalled projects don't unstall themselves.`);
    if (level === "low") level = "watch";
  }
  if (input.status === "on_hold") {
    factors.push("Parked on hold — not urgent, but don't let it fossilize.");
  }

  if (overdueMilestones.length >= 2 || (overdueMilestones.length >= 1 && input.pendingApprovals >= 2)) {
    level = "critical";
  }

  if (factors.length === 0) {
    factors.push("No overdue work, no pending approvals, momentum looks healthy.");
  }

  return { projectId: input.id, name: input.name, level, factors };
}

// ---------------------------------------------------------------------------
// 3. Surface stale leads
// ---------------------------------------------------------------------------

export function findStaleLeads(leads: RankedLead[], now = new Date(), thresholdDays = 7): StaleLead[] {
  return leads
    .filter((lead) => lead.status !== "not_interested" && lead.next_action_kind !== "closed")
    .map((lead) => {
      const quiet = daysBetween(lead.last_activity_at ?? lead.updated_at, now);
      return { lead, quiet: quiet ?? 0 };
    })
    .filter(({ lead, quiet }) => {
      if (lead.sla.applicable && lead.sla.status === "overdue") return true;
      return quiet >= thresholdDays && lead.next_action_kind !== "reply";
    })
    .map(({ lead, quiet }) => ({
      leadId: lead.id,
      businessName: lead.business_name,
      daysQuiet: quiet,
      reason:
        lead.sla.applicable && lead.sla.status === "overdue"
          ? `SLA breached — quiet for ${quiet} day${quiet === 1 ? "" : "s"}.`
          : `No activity in ${quiet} days (${lead.momentum_state}).`,
    }))
    .sort((a, b) => b.daysQuiet - a.daysQuiet);
}

// ---------------------------------------------------------------------------
// 4. Recommend the next studio action
// ---------------------------------------------------------------------------

export function recommendNextAction(args: {
  topLead?: RankedLead;
  topRisk?: ProjectRisk;
  topOpportunity?: { id: string; title: string; score: number | null };
  staleCount: number;
  now?: Date;
}): StudioRecommendation {
  const { topLead, topRisk, topOpportunity, staleCount } = args;

  if (topRisk && (topRisk.level === "critical" || topRisk.level === "high")) {
    return {
      title: `Unblock ${topRisk.name}`,
      detail: topRisk.factors[0] ?? "Project risk needs attention.",
      href: `/projects/${topRisk.projectId}`,
      why: "Client money is already on the table — delivery risk outranks new pipeline.",
    };
  }

  if (topLead && topLead.sla.applicable && topLead.sla.status === "overdue") {
    return {
      title: `Reply to ${topLead.business_name}`,
      detail: `Inbound SLA breached — due ${shortDate(topLead.sla.dueAt)}.`,
      href: `/leads/${topLead.id}`,
      why: "A breached SLA is a lead actively rotting. Nothing else matters until this is answered.",
    };
  }

  if (topLead) {
    return {
      title: `${topLead.actionTitle} — ${topLead.business_name}`,
      detail: topLead.actionMeta,
      href: `/leads/${topLead.id}`,
      why: "Top of the Flowkeep ranking: highest momentum, tightest clock, best fit.",
    };
  }

  if (topRisk && topRisk.level === "watch") {
    return {
      title: `Check in on ${topRisk.name}`,
      detail: topRisk.factors[0] ?? "Early warning signs.",
      href: `/projects/${topRisk.projectId}`,
      why: "Small risks are cheap to fix now and expensive later.",
    };
  }

  if (topOpportunity) {
    return {
      title: `Work ${topOpportunity.title}`,
      detail: `Radar score ${topOpportunity.score ?? "—"} — draft the bid before someone else does.`,
      href: `/opportunities/${topOpportunity.id}`,
      why: "Pipeline is empty enough that hunting beats waiting.",
    };
  }

  if (staleCount > 0) {
    return {
      title: "Resurrect a stale lead",
      detail: `${staleCount} lead${staleCount === 1 ? "" : "s"} going quiet.`,
      href: "/muse#stale",
      why: "Old leads are warm leads — cheaper than finding new ones.",
    };
  }

  return {
    title: "Capture the next lead",
    detail: "Nothing urgent. Suspiciously peaceful.",
    href: "/leads#quick-capture",
    why: "The studio runs on pipeline. Feed it.",
  };
}

// ---------------------------------------------------------------------------
// 6. Explain an opportunity's fit score
// ---------------------------------------------------------------------------

export type FitScoreExplanation = {
  opportunityId: string;
  score: number;
  verdict: string;
  strengths: string[];
  concerns: string[];
  notes: string | null;
  nudge: string | null;
};

const DIMENSION_LABELS: Record<FitDimensionKey, string> = Object.fromEntries(
  FIT_DIMENSIONS.map((d) => [d.key, d.label] as const),
) as Record<FitDimensionKey, string>;

const DIMENSION_HINTS: Record<FitDimensionKey, string> = Object.fromEntries(
  FIT_DIMENSIONS.map((d) => [d.key, d.hint] as const),
) as Record<FitDimensionKey, string>;

/**
 * Explains WHY an opportunity scored what it did, from the stored 5-dimension
 * breakdown and the human's fit notes. Deterministic — the explanation is the
 * breakdown, narrated. No LLM, no key, no cost.
 */
export function explainFitScore(args: {
  opportunityId: string;
  score: number;
  fitNotes: string | null;
  breakdown: Partial<FitBreakdown>;
}): FitScoreExplanation {
  const { opportunityId, score, fitNotes, breakdown } = args;
  const verdict = fitVerdict(score);

  const ranked = FIT_DIMENSIONS.map((d) => ({
    key: d.key as FitDimensionKey,
    score: Math.max(0, Math.min(20, Number(breakdown[d.key]) || 0)),
  })).sort((a, b) => b.score - a.score);

  const hasBreakdown = ranked.some((d) => d.score > 0);

  const strengths: string[] = [];
  const concerns: string[] = [];

  if (hasBreakdown) {
    for (const dim of ranked) {
      const label = DIMENSION_LABELS[dim.key];
      const hint = DIMENSION_HINTS[dim.key].toLowerCase();
      if (dim.score >= 15) {
        strengths.push(`${label} ${dim.score}/20 — ${hint}, and it shows.`);
      } else if (dim.score <= 8) {
        concerns.push(`${label} ${dim.score}/20 — ${hint}, which is the weak spot.`);
      }
    }
  }

  let nudge: string | null = null;
  if (score >= 80) {
    nudge = "Strong enough to bid — don't overthink it, just draft the proposal.";
  } else if (score >= 60) {
    nudge = "Proposal-worthy. Lead with the strengths above and price the concerns in.";
  } else if (score >= 40) {
    const weakest = ranked[ranked.length - 1];
    if (hasBreakdown && weakest) {
      nudge = `One conversation could fix this — ${DIMENSION_LABELS[weakest.key].toLowerCase()} is the only thing keeping it marginal.`;
    }
  } else {
    nudge = hasBreakdown
      ? "The numbers say pass. Trust them unless something material changes."
      : "Low score with no breakdown to learn from — pass unless your notes say otherwise.";
  }

  return {
    opportunityId,
    score,
    verdict,
    strengths,
    concerns,
    notes: fitNotes && fitNotes.trim() ? fitNotes.trim() : null,
    nudge,
  };
}

// ---------------------------------------------------------------------------
// 7. Draft follow-ups and proposals (saved as drafts — never sent)
// ---------------------------------------------------------------------------

const SIGNATURE = "Hailey\nNinth Heart Studios";

function firstName(contactName?: string | null): string {
  if (!contactName) return "there";
  return contactName.trim().split(/\s+/)[0] || "there";
}

export function draftFollowUp(
  lead: FlowkeepLead,
  kind: "nudge" | "consultation" | "check_in" = "nudge",
): GeneratedDraft {
  const name = firstName(lead.contact_name);
  const business = lead.business_name;

  if (kind === "consultation") {
    return {
      kind: "follow_up",
      subject: `Looking forward to our consultation — ${business}`,
      body: [
        `Hi ${name},`,
        ``,
        `Looking forward to our consultation. To make the 15 minutes count, it helps to know: what's the one thing about your current website (or lack of one) that bothers you most?`,
        ``,
        `No wrong answers — the more specific, the better I can come prepared.`,
        ``,
        SIGNATURE,
      ].join("\n"),
    };
  }

  if (kind === "check_in") {
    return {
      kind: "check_in",
      subject: `Quick check-in — ${business}`,
      body: [
        `Hi ${name},`,
        ``,
        `Circling back — when we last spoke, a stronger website was on your radar for ${business}. Still the case, or did priorities shift?`,
        ``,
        `Either way, happy to pick the thread back up whenever it makes sense.`,
        ``,
        SIGNATURE,
      ].join("\n"),
    };
  }

  return {
    kind: "follow_up",
    subject: `Following up — ${business}`,
    body: [
      `Hi ${name},`,
      ``,
      `Wanted to follow up on my last note about ${business}'s website. I work specifically with local businesses on sites that actually bring in customers — not just look pretty.`,
      ``,
      `Worth a 15-minute call to see if it's a fit? No pitch deck, I promise.`,
      ``,
      SIGNATURE,
    ].join("\n"),
  };
}

export function draftProposal(opportunity: {
  title: string;
  source?: string | null;
  url?: string | null;
}): GeneratedDraft {
  return {
    kind: "proposal",
    subject: `Proposal: website project — ${opportunity.title}`,
    body: [
      `Hi there,`,
      ``,
      `Thanks for the details on this project. Based on what you've described, here's how I'd approach it:`,
      ``,
      `SCOPE`,
      `A custom, mobile-first website built around one goal: turning visitors into customers. Includes design, copy polish, basic SEO setup, and launch support.`,
      ``,
      `PACKAGE FIT`,
      `[Confirm package + price before sending — current offers include The First Key ($500), The Signature Key ($900), The Tavern Key ($1,200), and The Full Heart Key ($1,500).]`,
      ``,
      `TIMELINE`,
      `Most projects run 2–4 weeks from kickoff, depending on content readiness.`,
      ``,
      `NEXT STEP`,
      `A free 15-minute consultation to lock in scope and make sure we're a good fit.`,
      ``,
      `I run a solo studio, so you work directly with me — the person designing and building your site — start to finish.`,
      ``,
      SIGNATURE,
    ].join("\n"),
  };
}

export function buildDraftFromTarget(target: DraftTarget, draftKind: MuseDraftKind): GeneratedDraft {
  if (target.type === "lead") {
    const kind = draftKind === "check_in" ? "check_in" : "nudge";
    return draftFollowUp(target.lead, kind);
  }
  if (target.type === "opportunity") {
    return draftProposal(target.opportunity);
  }
  const project = target.project;
  return {
    kind: "check_in",
    subject: `Quick update on your project — ${project.name}`,
    body: [
      `Hi ${project.clientName ? firstName(project.clientName) : "there"},`,
      ``,
      `Quick update on ${project.name}: things are moving along and I'll have something for you to review shortly.`,
      ``,
      `If anything's changed on your end — content, timing, priorities — now's a great time to tell me.`,
      ``,
      SIGNATURE,
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------------
// 8. Scope-creep guard: flag client requests that drift outside the project
//    scope, and draft a change order from them.
//
// Deterministic — keyword + scope-match heuristics over data the studio
// already has (project name, notes, milestone/task titles, shared documents).
// No LLM, no key, no cost. Verdicts are "likely in/out of scope", never
// certainties: the human prices and approves the change order.
// ---------------------------------------------------------------------------

export type ScopeCorpus = {
  terms: Set<string>;
  phrases: Set<string>;
  sourceLabels: string[];
};

export type ScopeCreepFlag =
  | { kind: "expansion_phrase"; detail: string }
  | { kind: "novel_work"; detail: string; novelTerms: string[] }
  | { kind: "scope_match"; detail: string; matchedTerms: string[] };

export type ScopeCreepVerdict = {
  requestId: string;
  requestText: string;
  inScope: boolean;
  confidence: "low" | "medium" | "high";
  flags: ScopeCreepFlag[];
  suggestedChangeOrder: { description: string } | null;
};

const SCOPE_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "this", "that", "these",
  "those", "from", "into", "out", "about", "can", "you", "your", "our", "are",
  "was", "were", "has", "have", "had", "will", "would", "should", "could",
  "please", "just", "also", "very", "more", "most", "some", "any", "all",
  "new", "old", "one", "two", "get", "make", "made", "use", "used", "using",
  "need", "needs", "want", "like", "look", "looks", "good", "great", "nice",
  "bit", "lot", "thing", "things", "something", "everything", "nothing",
  "its", "it's", "it", "they", "them", "their", "there", "here", "when",
  "where", "what", "which", "who", "how", "why", "not", "don't", "doesn't",
  "didn't", "won't", "can't", "isn't", "aren't", "wasn't", "i'm", "we're",
  "you're", "that's", "let's", "hey", "hi", "hello", "thanks", "thank",
  "maybe", "perhaps", "really", "quite", "still", "already", "yet", "too",
  "so", "as", "at", "by", "on", "in", "of", "to", "be", "is", "am", "do",
]);

/** Phrases that almost always signal the request is growing. */
const EXPANSION_PHRASES = [
  "while you're at it",
  "while you are at it",
  "also can you",
  "can you also",
  "could you also",
  "one more thing",
  "another thing",
  "what about adding",
  "could we add",
  "can we add",
  "additionally",
  "on top of that",
  "separate from",
  "in addition to",
  "extra page",
  "new page",
  "another page",
  "additional page",
  "new section",
  "extra section",
  "start over",
  "from scratch",
  "complete redesign",
  "full redesign",
];

/** Verbs that mark a request as additive work rather than a tweak. */
const ADDITIVE_VERBS = new Set([
  "add", "adding", "build", "building", "create", "creating", "integrate",
  "integrating", "redesign", "redesigning", "rewrite", "rewriting", "migrate",
  "migrating", "launch", "launching",
]);

/** Verbs that usually mark a tweak inside existing scope. */
const TWEAK_VERBS = new Set([
  "fix", "fixing", "tweak", "tweaking", "adjust", "adjusting", "update",
  "updating", "change", "changing", "move", "moving", "resize", "resizing",
  "recolor", "recoloring", "correct", "correcting", "typo", "swap", "swapping",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length >= 3 && !SCOPE_STOPWORDS.has(t));
}

/**
 * Builds the scope corpus from data the studio already has. The corpus is
 * what the client paid for; anything the request introduces beyond it is
 * suspect.
 */
export function buildScopeCorpus(args: {
  projectName: string;
  internalNotes?: string | null;
  milestoneTitles: string[];
  taskTitles: string[];
  documentTitles: string[];
}): ScopeCorpus {
  const terms = new Set<string>();
  const phrases = new Set<string>();
  const sourceLabels: string[] = [];

  const add = (label: string, text: string | null | undefined) => {
    if (!text || !text.trim()) return;
    sourceLabels.push(label);
    const tokens = tokenize(text);
    for (const t of tokens) terms.add(t);
    for (let i = 0; i < tokens.length - 1; i++) {
      phrases.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
  };

  add("project", args.projectName);
  add("notes", args.internalNotes);
  for (const t of args.milestoneTitles) add("milestone", t);
  for (const t of args.taskTitles) add("task", t);
  for (const t of args.documentTitles) add("document", t);

  return { terms, phrases, sourceLabels };
}

function findExpansionPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return EXPANSION_PHRASES.filter((p) => lower.includes(p));
}

/**
 * Compares one client request (portal message body or feedback pin comment)
 * against the project scope corpus. Returns an in/out-of-scope verdict with
 * flags explaining the reasoning, plus a change-order draft when the request
 * looks out of scope.
 */
export function analyzeScopeCreep(
  requestId: string,
  requestText: string,
  corpus: ScopeCorpus,
): ScopeCreepVerdict {
  const flags: ScopeCreepFlag[] = [];
  const tokens = tokenize(requestText);

  const expansions = findExpansionPhrases(requestText);
  for (const phrase of expansions) {
    flags.push({
      kind: "expansion_phrase",
      detail: `Uses the classic scope-grower "${phrase}" — the request is reaching beyond what was agreed.`,
    });
  }

  const matchedTerms = tokens.filter((t) => corpus.terms.has(t));
  const uniqueMatched = [...new Set(matchedTerms)];
  if (uniqueMatched.length > 0) {
    flags.push({
      kind: "scope_match",
      detail: `Touches scoped work (${uniqueMatched.slice(0, 5).join(", ")}${uniqueMatched.length > 5 ? "…" : ""}) — at least it names something on the plan.`,
      matchedTerms: uniqueMatched,
    });
  }

  const hasAdditive = tokens.some((t) => ADDITIVE_VERBS.has(t));
  const hasTweak = tokens.some((t) => TWEAK_VERBS.has(t));
  const novelTerms = [...new Set(tokens.filter((t) => !corpus.terms.has(t)))];

  if (hasAdditive && !hasTweak && novelTerms.length >= 2) {
    flags.push({
      kind: "novel_work",
      detail: `Introduces work not in the corpus (${novelTerms.slice(0, 6).join(", ")}${novelTerms.length > 6 ? "…" : ""}) with additive language — this reads like new scope, not a tweak.`,
      novelTerms,
    });
  }

  // Verdict: out of scope if there's an expansion phrase plus novel work,
  // or additive work with no scope overlap at all.
  const expansionWithNovelty = expansions.length > 0 && novelTerms.length >= 2;
  const additiveWithNoOverlap =
    hasAdditive && uniqueMatched.length === 0 && novelTerms.length >= 3;
  const outOfScope = expansionWithNovelty || additiveWithNoOverlap;

  let confidence: ScopeCreepVerdict["confidence"] = "low";
  if (outOfScope && expansions.length > 0 && novelTerms.length >= 4) confidence = "high";
  else if (outOfScope) confidence = "medium";
  else if (uniqueMatched.length >= 3) confidence = "high";

  const suggestedChangeOrder = outOfScope
    ? {
        description: `Client request flagged as out of scope (${confidence} confidence): "${requestText.slice(0, 220)}${requestText.length > 220 ? "…" : ""}" — price the fee and timeline impact before proceeding.`,
      }
    : null;

  return {
    requestId,
    requestText,
    inScope: !outOfScope,
    confidence,
    flags,
    suggestedChangeOrder,
  };
}
