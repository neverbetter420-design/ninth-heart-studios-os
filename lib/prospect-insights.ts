// Evidence-grounded, read-only explanations for why a local prospect may merit
// manual review. Never present a missing homepage signal as a proven business flaw.
import { normalizeWebsite, type WebsiteSignals } from "./prospect-scan.ts";
import { safeIndustryEvidenceUrl } from "./prospect-industry-audit.ts";

export type ProspectInsight = {
  key: string;
  title: string;
  detail: string;
  basis: "homepage" | "directory" | "unknown";
  kind: "review" | "observed" | "unverified";
  evidence_url?: string;
  checked_at?: string;
};

export function buildProspectInsights(
  s: Partial<WebsiteSignals> | null | undefined,
  rawWebsite: string | null,
  limit = 3,
): ProspectInsight[] {
  const cap = Number.isInteger(limit) ? Math.max(1, Math.min(6, limit)) : 3;
  const site = normalizeWebsite(rawWebsite);
  if (!site || !s?.has_website) {
    return [{
      key: "unknown-site", title: "Website needs confirmation",
      detail: "The available listing did not establish a confirmed business website. This is not proof one does not exist.",
      basis: "directory", kind: "unverified",
    }];
  }
  if (!s.reachable) {
    return [{
      key: "unavailable", title: "Website check was inconclusive",
      detail: "The scanner could not inspect a usable homepage on this attempt. Retry before drawing conclusions or drafting criticism.",
      basis: "unknown", kind: "unverified",
    }];
  }
  const out: ProspectInsight[] = [];
  const date = s.industry_audit?.scanned_at;
  const push = (row: ProspectInsight) => {
    if (out.length < cap && !out.some(x => x.key === row.key)) out.push(row);
  };
  // Positive confirmations are intentionally kept separate from review clues.
  // The highest-value questions are tailored to the actual business niche.
  for (const item of s.industry_audit?.signals ?? []) {
    if (item.status !== "not_observed_on_homepage" || item.key === "mobile_viewport") continue;
    if (out.length >= Math.min(cap, 2)) break;
    push({
      key: "industry-" + item.key,
      title: "Check " + item.label.toLowerCase(),
      detail: "Not observed on the fetched homepage. It may exist on a different page or in a third-party tool.",
      basis: "homepage", kind: "review", checked_at: date,
    });
  }
  if (s.mobile_viewport === false) push({
    key: "viewport", title: "Review mobile page setup",
    detail: "A standard viewport tag was not detected in the fetched HTML. This does not prove a mobile layout problem.",
    basis: "homepage", kind: "review", checked_at: date,
  });
  if (s.description_ok === false) push({
    key: "description", title: "Review search description",
    detail: "A standard meta description was not detected in the fetched homepage HTML. Other metadata may exist.",
    basis: "homepage", kind: "review", checked_at: date,
  });
  if (s.https === false) push({
    key: "https", title: "Check secure URL routing",
    detail: "The inspected response did not use HTTPS. Verify redirects and the browser address before suggesting a fix.",
    basis: "homepage", kind: "review", checked_at: date,
  });
  if (s.stale_copyright && typeof s.copyright_year === "number") push({
    key: "copyright", title: "Review dated footer information",
    detail: "The inspected homepage HTML references copyright year " + s.copyright_year +
      ". A dated footer alone does not mean the business is inactive.",
    basis: "homepage", kind: "review", checked_at: date,
  });
  // Supply *positive* observed evidence when nothing significant needs review.
  for (const item of s.industry_audit?.signals ?? []) {
    if (out.length >= cap) break;
    if (item.status !== "observed" || item.key === "mobile_viewport") continue;
    const reviewedUrl = safeIndustryEvidenceUrl(site, item.evidence_url);
    push({
      key: "observed-" + item.key,
      title: item.label + " found",
      detail: "The link or text was detected on the fetched homepage. This is an observation, not a usability rating.",
      basis: "homepage", kind: "observed", checked_at: date,
      ...(reviewedUrl ? { evidence_url: reviewedUrl } : {}),
    });
  }
  if (!out.length) push({
    key: "manual", title: "Review the website personally",
    detail: "The automated homepage signals do not establish a specific redesign need. A human review is required.",
    basis: "homepage", kind: "unverified", checked_at: date,
  });
  return out.slice(0, cap);
}
