// Phase 6 — Opportunity Radar: statuses, sources, fit scoring.

export const OPPORTUNITY_STATUSES = [
  { key: "new", label: "New" },
  { key: "reviewing", label: "Reviewing" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "submitted", label: "Submitted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "passed", label: "Passed" },
] as const;

export type OpportunityStatusKey = (typeof OPPORTUNITY_STATUSES)[number]["key"];

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  OPPORTUNITY_STATUSES.map((s) => [s.key, s.label] as const)
);

export function opportunityStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function isOpportunityStatus(status: string): boolean {
  return status in STATUS_LABELS;
}

/** Approved import sources. Radar intake only accepts these. */
export const APPROVED_SOURCES = [
  "Upwork",
  "Fiverr",
  "Freelancer",
  "Referral",
  "Job Board",
  "Direct",
  "Manual",
] as const;

export function isApprovedSource(source: string): boolean {
  return (APPROVED_SOURCES as readonly string[]).includes(source);
}

/** Fit scoring dimensions — each 0–20, total 0–100. */
export const FIT_DIMENSIONS = [
  { key: "project_fit", label: "Project fit", hint: "How well it matches NHS services" },
  { key: "budget", label: "Budget", hint: "Budget realism for the scope" },
  { key: "platform", label: "Platform", hint: "Wix-friendly (or convertible) work" },
  { key: "niche", label: "Niche", hint: "Bars, restaurants, salons, local services" },
  { key: "clarity", label: "Scope clarity", hint: "How well-defined the ask is" },
] as const;

export type FitDimensionKey = (typeof FIT_DIMENSIONS)[number]["key"];

export type FitBreakdown = Record<FitDimensionKey, number>;

export function totalFitScore(breakdown: Partial<FitBreakdown>): number {
  return FIT_DIMENSIONS.reduce(
    (sum, d) => sum + Math.max(0, Math.min(20, Number(breakdown[d.key]) || 0)),
    0
  );
}

export function fitVerdict(score: number): string {
  if (score >= 80) return "Strong fit — chase it";
  if (score >= 60) return "Worth a proposal";
  if (score >= 40) return "Marginal — needs a closer look";
  return "Probably a pass";
}


/** Freelancer opportunities remain separate from local-business Lead Scanner. */
export const FREELANCE_SOURCES = [
  { name: "Upwork", href: "https://www.upwork.com/nx/find-work/", help: "Review jobs in your own account", mode: "Manual until approved API access" },
  { name: "Fiverr", href: "https://www.fiverr.com/", help: "Review personalized seller matches and briefs", mode: "Manual seller review" },
  { name: "Freelancer", href: "https://www.freelancer.com/jobs/", help: "Browse posted projects", mode: "Manual until approved API connection" },
] as const;

export function isFreelanceMarketplace(source: string): boolean {
  return FREELANCE_SOURCES.some(s => s.name === source);
}

/** Keep manually entered marketplace links attributed to the correct platform. */
export function validSourceListingUrl(source: string, raw: string | null): boolean {
  if (!raw) return true;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    const hosts: Record<string, string> = {
      Upwork: "upwork.com",
      Fiverr: "fiverr.com",
      Freelancer: "freelancer.com",
    };
    const allowed = hosts[source];
    return allowed ? (host === allowed || host.endsWith("." + allowed)) : true;
  } catch {
    return false;
  }
}

export type GigFitPreview = {
  score: number | null;
  breakdown: FitBreakdown | null;
  confidence: "insufficient" | "preliminary";
  strengths: string[];
  questions: string[];
};

/**
 * Evidence-limited, deterministic gig triage. This is NOT an AI model,
 * a live API search, or a prediction of winning the contract.
 * The editable FitScorer remains the official owner-assessed score.
 */
export function estimateGigFit(title: string, brief: string, budgetUsd: number | null): GigFitPreview {
  const text = (title + " " + brief).toLowerCase().replace(/\s+/g, " ").trim();
  if (text.length < 35) {
    return { score: null, breakdown: null, confidence: "insufficient",
      strengths: [], questions: ["Add the client's project brief to assess fit, scope and budget."] };
  }
  const has = (pattern: RegExp) => pattern.test(text);
  const websiteWork = has(/\b(web(?:site| design| redesign)|landing page|responsive site|site redesign|site build)\b/);
  const relatedWork = has(/\b(booking|reservations?|menu|online ordering|forms?|seo|copywriting|branding)\b/);
  const wix = has(/\bwix\b/);
  const alternateStack = has(/\b(shopify|react native|flutter|ios app|android app|laravel|wordpress plugin|magento)\b/);
  const niche = has(/\b(restaurant|bistro|cafe|bar|pub|salon|barber|spa|local business|small business|service provider)\b/);
  const fixed = typeof budgetUsd === "number" && Number.isFinite(budgetUsd) && budgetUsd > 0;
  const details = brief.trim().split(/\s+/).filter(Boolean).length;
  const hasScope = has(/\b(pages?|design|redesign|booking|online ordering|responsive|migration|seo|forms?)\b/);
  const clearDeadline = has(/\b(deadline|timeline|deliver|week|month|launch|by \w+ \d+)\b/);

  const breakdown: FitBreakdown = {
    project_fit: websiteWork ? 20 : relatedWork ? 12 : 4,
    budget: fixed ? (budgetUsd >= 900 ? 20 : budgetUsd >= 500 ? 15 : budgetUsd >= 250 ? 8 : 3) : 10,
    platform: wix ? 20 : alternateStack ? 3 : 12,
    niche: niche ? 20 : 10,
    clarity: Math.min(20, (details >= 30 ? 12 : details >= 15 ? 8 : 4) +
      (hasScope ? 4 : 0) + (clearDeadline ? 4 : 0)),
  };
  const strengths: string[] = [];
  if (websiteWork) strengths.push("Project mentions website design or redesign");
  if (wix) strengths.push("Wix is explicitly mentioned");
  if (niche) strengths.push("Business category matches NHS's focus");
  if (fixed && budgetUsd >= 500) strengths.push("Stated budget is in range for an NHS entry package");
  const questions: string[] = [];
  if (!fixed) questions.push("Confirm the project's actual budget and currency");
  if (!hasScope || details < 15) questions.push("Clarify the page count, deliverables and revisions");
  if (!clearDeadline) questions.push("Confirm the timeline and launch deadline");
  if (alternateStack && !wix) questions.push("Confirm whether the required technology fits NHS services");
  return { score: totalFitScore(breakdown), breakdown, confidence: "preliminary", strengths, questions };
}
