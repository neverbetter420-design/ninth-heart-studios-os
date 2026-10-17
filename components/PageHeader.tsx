import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  actionHref,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow electric">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="page-description">{description}</p>
      </div>
      {action && actionHref ? <Link className="primary-button page-header-action" href={actionHref}>{action}</Link> : null}
    </header>
  );
}
