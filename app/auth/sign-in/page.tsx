import { signIn } from "./actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <div className="auth-brand-mark">♥</div>
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h1>Enter NHS OS</h1>
        <p className="auth-copy">Private studio access for NHS Admin and invited NHS Clients.</p>

        {error ? <div className="auth-error">{error}</div> : null}

        <form action={signIn} className="auth-form">
          <label>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required minLength={12} />
          </label>
          <button className="primary-button wide" type="submit">Sign in</button>
        </form>

        <p className="auth-footnote">Public registration is disabled. Client accounts are invite-only.</p>
        <p className="auth-footnote"><a href="https://www.ninthheartstudios.com">← Back to Ninth Heart Studios</a></p>
      </section>
    </main>
  );
}
