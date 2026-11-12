import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStagingReviewDecision, REVIEW_PREVIEW_ORIGIN } from "@/lib/staging-read-only";

/**
 * Staging review sign-in is an ordinary Route Handler, never a Next Server
 * Action. This narrowly scoped auth-only exception is not deployed yet.
 * Regular production sign-in continues to use the existing Server Action.
 */
export async function POST(request: NextRequest) {
  const decision = getStagingReviewDecision(
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

  if (!decision.readOnly || decision.blocked) {
    return NextResponse.json(
      { error: "The protected review sign-in is unavailable." },
      { status: decision.blocked ? decision.status : 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Route Handlers do not inherit Next Server Action CSRF protection.
  // Fail closed on unknown origins, unexpected form types and action requests.
  if (
    request.headers.get("origin") !== REVIEW_PREVIEW_ORIGIN ||
    !request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded") ||
    (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")
  ) {
    return NextResponse.json(
      { error: "Sign-in request rejected." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, REVIEW_PREVIEW_ORIGIN), {
      status: 303,
      headers: { "Cache-Control": "no-store" },
    });

  if (!email || !password || email.length > 254 || password.length > 1024) {
    return redirectTo("/auth/sign-in?error=Invalid%20email%20or%20password.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return redirectTo("/auth/sign-in?error=Sign%20in%20failed.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return redirectTo("/auth/sign-in?error=This%20account%20is%20not%20active.");
  }

  return redirectTo(profile.role === "client" ? "/portal" : "/");
}
