import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Only reachable with a valid recovery session (set by /auth/callback).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/sign-in?error=Reset%20link%20is%20invalid%20or%20expired.%20Request%20a%20new%20one.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <div className="auth-brand-mark">♥</div>
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h1>Choose a new password</h1>
        <p className="auth-copy">
          Setting a new password for <strong>{user.email}</strong>.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form action={updatePassword} className="auth-form">
          <label>
            <span>New password</span>
            <input name="password" type="password" autoComplete="new-password" required minLength={12} />
          </label>
          <label>
            <span>Confirm new password</span>
            <input name="confirm" type="password" autoComplete="new-password" required minLength={12} />
          </label>
          <button className="primary-button wide" type="submit">Set new password</button>
        </form>

        <p className="auth-footnote">Minimum 12 characters.</p>
      </section>
    </main>
  );
}
