import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getStagingReviewDecision } from "./lib/staging-read-only";

export async function proxy(request: NextRequest) {
  const review = getStagingReviewDecision(
    {
      method: request.method,
      pathname: request.nextUrl.pathname,
      hostname: request.nextUrl.hostname,
    },
    process.env,
  );
  if (review.blocked) {
    return NextResponse.json(
      { error: review.status === 503
        ? "The protected preview is not configured safely for review."
        : "This staging preview is read-only. No changes were made." },
      {
        status: review.status,
        headers: {
          "Cache-Control": "no-store",
          "X-NHS-Review-Mode": "read-only",
          ...(review.status === 405 ? { Allow: "GET, HEAD, OPTIONS" } : {}),
        },
      },
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Supabase recommends validating/refreshing auth in the Next.js proxy so
  // Server Components receive fresh cookie-backed credentials.
  await supabase.auth.getClaims();

  if (review.readOnly) response.headers.set("X-NHS-Review-Mode", "read-only");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
