import Link from "next/link";
import type { ReactNode } from "react";

export function DocumentNav({
  current,
}: {
  current: "contracts" | "forms" | "templates";
}) {
  return (
    <nav className="paperwork-nav" aria-label="Document tools">
      {[
        ["contracts", "Contracts", "Agreements & signatures"],
        ["forms", "Fillable forms", "Fields & client responses"],
        ["templates", "Text templates", "Reusable studio copy"],
      ].map(([key, title, detail]) => (
        <Link
          key={key}
          href={`/${key}`}
          aria-current={current === key ? "page" : undefined}
        >
          <strong>{title}</strong>
          <span>{detail}</span>
        </Link>
      ))}
    </nav>
  );
}

export function DocumentCreate({
  title,
  detail,
  open = false,
  children,
}: {
  title: string;
  detail: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="nocturne-create-panel" aria-label={title} open={open}>
      <summary className="nocturne-create-toggle">
        <strong>{title}</strong>
        <span>{detail}</span>
      </summary>
      {children}
    </details>
  );
}

export function DocumentSectionHeading({
  eyebrow,
  title,
  detail,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="management-section-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3>{title}</h3>
      </div>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

export function DocumentNotice({ children }: { children: ReactNode }) {
  return (
    <p className="management-notice" role="alert">
      {children}
    </p>
  );
}

export function documentDate(value: string | null, withTime = false) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
    ...(withTime
      ? ({ hour: "numeric", minute: "2-digit", timeZoneName: "short" } as const)
      : {}),
  });
}
