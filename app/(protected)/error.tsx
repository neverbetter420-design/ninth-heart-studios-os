"use client";

import Link from "next/link";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="content-wrap">
      <section className="panel workspace-feedback" role="alert">
        <p className="eyebrow electric">Ninth Heart Studios</p>
        <h2>We couldn't load this page.</h2>
        <p>
          Your workspace is still here. Something interrupted this request.
          You can try again or return to the main dashboard.
        </p>
        <div className="workspace-feedback-actions">
          <button type="button" className="primary-button" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="secondary-button">Go to workspace</Link>
        </div>
      </section>
    </div>
  );
}
