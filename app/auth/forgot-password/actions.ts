"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { passwordRecoveryRedirectUrl, passwordResetErrorMessage } from "@/lib/password-recovery";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/auth/forgot-password?error=Enter%20a%20valid%20email%20address.");
  }

  // Never derive a password-reset destination from the request Host header:
  // that would allow Host-header poisoning of emailed reset links.
  const appUrl =
    process.env.NHS_APP_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? "https://app.ninthheartstudios.com"
      : "http://localhost:3000");
  const parsedUrl = new URL(appUrl);
  const isLocalDev = process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(parsedUrl.hostname);
  if (parsedUrl.protocol !== "https:" && !(isLocalDev && parsedUrl.protocol === "http:")) {
    throw new Error("NHS_APP_URL must be an HTTPS URL outside local development.");
  }

  const supabase = await createClient();
  let errorMessage: string | null = null;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwordRecoveryRedirectUrl(appUrl),
    });

    if (error) {
      // Codes/status only: do not log account emails or Supabase session data.
      console.warn("[NHS auth] Password reset request rejected", {
        code: error.code ?? "unknown",
        status: error.status ?? 0,
      });
      errorMessage = passwordResetErrorMessage({
        code: error.code,
        status: error.status,
      });
    }
  } catch {
    // Network / provider outages must not become an unhandled server error.
    console.error("[NHS auth] Password reset request failed before a response.");
    errorMessage = passwordResetErrorMessage();
  }

  if (errorMessage) {
    redirect(`/auth/forgot-password?error=${encodeURIComponent(errorMessage)}`);
  }

  // Identical message whether or not the submitted email is registered.
  redirect("/auth/forgot-password?sent=1");
}
