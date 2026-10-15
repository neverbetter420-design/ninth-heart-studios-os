"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPasswordRecoveryReturn } from "@/lib/password-recovery";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const returnUrl = new URL(window.location.href);

    // A normal authenticated session is NOT evidence of an email recovery.
    if (!isPasswordRecoveryReturn(returnUrl)) {
      setStatus("invalid");
      return;
    }

    const supabase = createClient();

    async function checkRecoverySession() {
      // getUser validates the authenticated identity with Supabase Auth and
      // waits for the browser client to process PKCE codes or recovery fragments.
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !data.user?.email) {
        setStatus("invalid");
        return;
      }

      setEmail(data.user.email);
      setStatus("ready");

      // Remove recovery codes/tokens from the browser URL and history.
      window.history.replaceState(window.history.state, "", "/auth/reset-password");
    }

    void checkRecoverySession().catch(() => {
      if (active) setStatus("invalid");
    });

    return () => { active = false; };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;

    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Close the short-lived recovery session. The user signs in afresh.
      await supabase.auth.signOut();
      router.replace("/auth/sign-in?reset=success");
      router.refresh();
    } catch {
      setError("Unable to update your password. Request a new reset link and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <div className="auth-brand-mark">♥</div>
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h1>Choose a new password</h1>

        {status === "checking" && (
          <p className="auth-copy">Verifying your reset link…</p>
        )}

        {status === "invalid" && (
          <>
            <div className="auth-error" role="alert">
              This reset link is invalid, expired, or has already been used.
            </div>
            <p className="auth-footnote">
              <a href="/auth/forgot-password">Request a new reset link</a>
            </p>
          </>
        )}

        {status === "ready" && (
          <>
            <p className="auth-copy">
              Setting a new password for <strong>{email}</strong>.
            </p>
            {error ? <div className="auth-error" role="alert">{error}</div> : null}
            <form onSubmit={onSubmit} className="auth-form">
              <label>
                <span>New password</span>
                <input name="password" type="password" autoComplete="new-password" required minLength={12} disabled={saving} />
              </label>
              <label>
                <span>Confirm new password</span>
                <input name="confirm" type="password" autoComplete="new-password" required minLength={12} disabled={saving} />
              </label>
              <button className="primary-button wide" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Set new password"}
              </button>
            </form>
            <p className="auth-footnote">Use at least 12 characters. You’ll sign in again afterward.</p>
          </>
        )}
      </section>
    </main>
  );
}
