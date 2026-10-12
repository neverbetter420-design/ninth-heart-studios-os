export default function UnauthorizedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card panel">
        <div className="auth-brand-mark">×</div>
        <p className="eyebrow electric">Access blocked</p>
        <h1>This account cannot enter NHS OS.</h1>
        <p className="auth-copy">The user profile is missing, inactive, or does not have an approved NHS role.</p>
        <form action="/auth/sign-out" method="post">
          <button className="secondary-button wide" type="submit">Sign out</button>
        </form>
      </section>
    </main>
  );
}
