import { PageHeader } from "./PageHeader";

export function ModulePage({
  eyebrow,
  title,
  description,
  status = "Foundation ready",
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
  items: { title: string; description: string }[];
}) {
  return (
    <div className="content-wrap">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="panel module-hero">
        <span className="beta-pill">{status}</span>
        <h3>This module is wired into the new NHS shell.</h3>
        <p>Live database actions stay disabled until authentication and Supabase are configured and tested.</p>
      </section>
      <section className="module-grid">
        {items.map((item) => (
          <article className="panel module-card" key={item.title}>
            <div className="module-card-icon">✦</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="text-button">Planned for build</span>
          </article>
        ))}
      </section>
    </div>
  );
}
