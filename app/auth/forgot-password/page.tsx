import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <div className="auth-brand-mark">♥</div>
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h1>Reset password</h1>
        <p className="auth-copy">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        {error ? <div className="auth-error">{error}</div> : null}
        {sent ? (
          <div className="auth-error" style={{ borderColor: "rgba(104,244,181,.25)", color: "#9cecc6" }}>
            Check your inbox — if the email exists, a reset link is on its way.
          </div>
        ) : null}

        <form action={requestPasswordReset} className="auth-form">
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="primary-button wide" type="submit">Send reset link</button>
        </form>

        <p className="auth-footnote"><a href="/auth/sign-in">← Back to sign in</a></p>
      </section>
    </main>
  );
}
