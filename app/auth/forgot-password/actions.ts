"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect("/auth/forgot-password?error=Enter%20a%20valid%20email%20address.");
  }

  const supabase = await createClient();
  const host = (await headers()).get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const redirectTo = `${proto}://${host}/auth/callback?next=/auth/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    redirect(`/auth/forgot-password?error=${encodeURIComponent(error.message)}`);
  }

  // Never reveal whether the email exists — same message either way.
  redirect("/auth/forgot-password?sent=1");
}
