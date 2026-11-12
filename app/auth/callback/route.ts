import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStagingReviewDecision } from "@/lib/staging-read-only";

export async function GET(request: NextRequest) {
  // Defense in depth: a review-mode callback can mutate Auth state even
  // though it uses GET. The Proxy also blocks this request before routing.
  const review = getStagingReviewDecision(
    {
      method: request.method,
      pathname: request.nextUrl.pathname,
      hostname: request.nextUrl.hostname,
    },
    {
      NHS_STAGING_READ_ONLY: process.env.NHS_STAGING_READ_ONLY,
      NHS_APP_URL: process.env.NHS_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  );
  if (review.blocked) {
    return NextResponse.json(
      { error: "Authentication callbacks are unavailable in this review preview." },
      {
        status: review.status,
        headers: { "Cache-Control": "no-store", "X-NHS-Review-Mode": "read-only" },
      },
    );
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isRecovery = type === "recovery" || searchParams.get("flow") === "recovery";
  const next = searchParams.get("next") ?? "/";
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/";

  const supabase = await createClient();

  // Support SSR PKCE callbacks (code) and token-hash email templates (verifyOtp).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(isRecovery ? "/auth/reset-password?recovery=1" : safeNext, origin),
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(
        new URL(isRecovery ? "/auth/reset-password?recovery=1" : safeNext, origin),
      );
    }
  }

  return NextResponse.redirect(
    new URL(
      isRecovery
        ? "/auth/reset-password?error=invalid"
        : "/auth/sign-in?error=Authentication%20link%20is%20invalid%20or%20expired.",
      origin,
    ),
  );
}
