/**
 * Source-only Issue #71 preview request barrier.
 * This is not a database security boundary: Supabase Data API calls made
 * directly from a browser bypass Next.js Proxy. Keep RLS and staging isolation.
 */
export const REVIEW_PREVIEW_HOST = "design-velvet-atelier-admin-pilot-nhs-os-velvet-atelier-preview.neverbetter420.workers.dev";
export const REVIEW_PREVIEW_ORIGIN = "https://design-velvet-atelier-admin-pilot-nhs-os-velvet-atelier-preview.neverbetter420.workers.dev";
export const REVIEW_SUPABASE_ORIGIN = "https://qihwmfwlhsetxwggaesd.supabase.co";

type ReviewRequest = { method: string; pathname: string; hostname: string };
type ReviewEnvironment = {
  NHS_STAGING_READ_ONLY?: string;
  NHS_APP_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};
type ReviewDecision =
  | { readOnly: false; blocked: false }
  | { readOnly: true; blocked: false }
  | { readOnly: true; blocked: true; status: 405 | 503 };

/** Fail closed on the exact protected preview hostname if configuration drifts. */
export function getStagingReviewDecision(
  request: ReviewRequest,
  env: ReviewEnvironment,
): ReviewDecision {
  const previewHost = request.hostname.toLowerCase() === REVIEW_PREVIEW_HOST;
  const requested = env.NHS_STAGING_READ_ONLY === "true";
  if (!previewHost && !requested) return { readOnly: false, blocked: false };

  if (
    !previewHost ||
    !requested ||
    env.NHS_APP_URL !== REVIEW_PREVIEW_ORIGIN ||
    env.NEXT_PUBLIC_SUPABASE_URL !== REVIEW_SUPABASE_ORIGIN
  ) {
    return { readOnly: true, blocked: true, status: 503 };
  }

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { readOnly: true, blocked: false };
  }

  // Reviewers can establish/end a session. This is an explicit auth-only
  // exception; arbitrary actions still require a separate data-layer gate.
  if (
    method === "POST" &&
    (request.pathname === "/auth/sign-in" || request.pathname === "/auth/sign-out")
  ) {
    return { readOnly: true, blocked: false };
  }

  // This blocks regular Next Server Action form submissions and API writes,
  // including manual automation runs and scans, on this preview hostname.
  return { readOnly: true, blocked: true, status: 405 };
}
