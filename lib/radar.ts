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
