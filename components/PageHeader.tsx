export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow electric">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="page-description">{description}</p>
      </div>
      {action ? <button className="primary-button">{action}</button> : null}
    </header>
  );
}
