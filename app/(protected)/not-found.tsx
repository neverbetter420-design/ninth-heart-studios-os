import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="content-wrap">
      <section className="panel workspace-feedback">
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h2>That page isn't available.</h2>
        <p>
          This link may be outdated, or the requested item may no longer
          be available to your account.
        </p>
        <div className="workspace-feedback-actions">
          <Link href="/" className="primary-button">Return to workspace</Link>
        </div>
      </section>
    </div>
  );
}
