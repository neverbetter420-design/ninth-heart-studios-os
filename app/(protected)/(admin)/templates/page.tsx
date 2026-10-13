import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { categoryLabel } from "@/lib/templates";
import { createClient } from "@/lib/supabase/server";
import type { Template } from "@/lib/supabase/types";
import { createTemplate } from "./actions";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string }>;
}) {
  const { error: formError, category: categoryFilter } = await searchParams;
  const supabase = await createClient();

  const { data: raw } = await supabase
    .from("templates")
    .select("id, name, category, content, active, created_at, updated_at")
    .order("updated_at", { ascending: false });
  const templates = (raw ?? []) as Template[];

  const active = templates.filter((t) => t.active);
  const archived = templates.filter((t) => !t.active);
  const shown = categoryFilter
    ? active.filter((t) => t.category === categoryFilter)
    : active;

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Master Templates</p>
          <h2>Reusable without looking recycled.</h2>
          <p className="page-description">
            One controlled library for contracts and studio documents. Write it
            once, use it on every project.
          </p>
        </div>
      </header>

      {formError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(formError)}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Template metrics">
        <MetricCard label="Active" value={String(active.length)} detail="Ready to use" tone="violet" />
        <MetricCard
          label="Contract templates"
          value={String(active.filter((t) => t.category === "contract").length)}
          detail="Prefill contract bodies"
          tone="pink"
        />
        <MetricCard
          label="Document templates"
          value={String(active.filter((t) => t.category === "document").length)}
          detail="Prefill document notes"
          tone="cyan"
        />
        <MetricCard label="Archived" value={String(archived.length)} detail="Retired, not deleted" tone="green" />
      </section>

      <section className="panel" aria-label="New template" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>New template</h3>
        </div>
        <form action={createTemplate} style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="delivery-add-form" style={{ padding: 0 }}>
            <input type="text" name="name" placeholder="Template name…" required maxLength={160} />
            <select name="category" defaultValue="contract" aria-label="Category">
              <option value="contract">Contract</option>
              <option value="document">Document</option>
            </select>
          </div>
          <label className="field">
            <span>Body</span>
            <textarea
              name="body"
              className="notes-area"
              style={{ minHeight: 140 }}
              placeholder="The reusable text — scope, payment terms, welcome packet, handoff checklist…"
            />
          </label>
          <div>
            <button type="submit" className="mini-button go">Create template</button>
          </div>
        </form>
      </section>

      <section className="panel" aria-label="Templates">
        <div className="panel-heading">
          <h3>Templates</h3>
          <span style={{ display: "flex", gap: 8 }}>
            <Link href="/templates" className="mini-button">All</Link>
            <Link href="/templates?category=contract" className="mini-button">Contracts</Link>
            <Link href="/templates?category=document" className="mini-button">Documents</Link>
          </span>
        </div>
        <ul className="delivery-list">
          {shown.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No templates here yet. The first one is the hardest; the rest are copy-paste.</p>
            </li>
          ) : (
            shown.map((t) => (
              <li key={t.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">
                    <Link href={`/templates/${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {t.name}
                    </Link>
                  </p>
                  <p className="delivery-row-sub">
                    {categoryLabel(t.category)} · Updated{" "}
                    {new Date(t.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className="delivery-pill visible">{categoryLabel(t.category)}</span>
              </li>
            ))
          )}
        </ul>
        {archived.length > 0 ? (
          <div style={{ padding: "0 18px 14px" }}>
            <p className="muted-copy" style={{ fontSize: 12 }}>
              Archived: {archived.map((t) => t.name).join(", ")}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
