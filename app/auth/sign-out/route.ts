import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStagingReviewDecision, REVIEW_PREVIEW_ORIGIN } from "@/lib/staging-read-only";

export async function POST(request: NextRequest) {
  const review = getStagingReviewDecision(
    {
      method: request.method,
      pathname: request.nextUrl.pathname,
      hostname: request.nextUrl.hostname,
      hasNextActionHeader: request.headers.has("next-action"),
    },
    {
      NHS_STAGING_READ_ONLY: process.env.NHS_STAGING_READ_ONLY,
      NHS_APP_URL: process.env.NHS_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  );

  // Preserve the production sign-out flow. In review mode, signing out is
  // the only allowed session mutation and must be a same-origin form POST.
  if (review.blocked) {
    return NextResponse.json(
      { error: "The protected review sign-out is unavailable." },
      { status: review.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    review.readOnly &&
    (
      request.headers.get("origin") !== REVIEW_PREVIEW_ORIGIN ||
      (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")
    )
  ) {
    return NextResponse.json(
      { error: "Sign-out request rejected." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/sign-in", request.url), { status: 303 });
}
