import { signIn } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const { error, reset } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <div className="auth-brand-mark">♥</div>
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h1>Enter NHS OS</h1>
        <p className="auth-copy">Private studio access for NHS Admin and invited NHS Clients.</p>

        {reset === "success" ? <div className="auth-success" role="status">Password updated. Sign in with your new password.</div> : null}
        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        <form action={signIn} className="auth-form">
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="primary-button wide" type="submit">Sign in</button>
        </form>

        <p className="auth-footnote"><a href="/auth/forgot-password">Forgot password?</a></p>
        <p className="auth-footnote">Public registration is disabled. Client accounts are invite-only.</p>
        <p className="auth-footnote"><a href="https://www.ninthheartstudios.com">← Back to Ninth Heart Studios</a></p>
      </section>
    </main>
  );
}
