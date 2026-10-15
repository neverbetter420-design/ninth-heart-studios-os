"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // The browser client auto-detects the recovery session from the URL
    // fragment (#access_token=...) that Supabase appends to the reset link.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setEmail(data.session.user.email);
        setStatus("ready");
      } else {
        setStatus("invalid");
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setEmail(session.user.email);
        setStatus("ready");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace("/");
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
            <div className="auth-error">
              This reset link is invalid or expired.
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
            {error ? <div className="auth-error">{error}</div> : null}
            <form onSubmit={onSubmit} className="auth-form">
              <label>
                <span>New password</span>
                <input name="password" type="password" autoComplete="new-password" required minLength={12} />
              </label>
              <label>
                <span>Confirm new password</span>
                <input name="confirm" type="password" autoComplete="new-password" required minLength={12} />
              </label>
              <button className="primary-button wide" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Set new password"}
              </button>
            </form>
            <p className="auth-footnote">Minimum 12 characters.</p>
          </>
        )}
      </section>
    </main>
  );
}
