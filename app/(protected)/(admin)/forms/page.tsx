import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { categoryLabel } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { FormSubmission, FormTemplate } from "@/lib/supabase/types";
import { createFormTemplate } from "./actions";

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string }>;
}) {
  const { error: formError, category: categoryFilter } = await searchParams;
  const supabase = await createClient();

  const [{ data: rawTemplates }, { data: rawSubmissions }] = await Promise.all([
    supabase
      .from("form_templates")
      .select("id, name, category, description, fields, active, created_at, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("form_submissions")
      .select("id, status")
      .order("created_at", { ascending: false }),
  ]);
  const templates = (rawTemplates ?? []) as FormTemplate[];
  const submissions = (rawSubmissions ?? []) as FormSubmission[];

  const active = templates.filter((t) => t.active);
  const shown = categoryFilter ? active.filter((t) => t.category === categoryFilter) : active;
  const pending = submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Fillable Forms</p>
          <h2>Your paperwork, but it fills itself in.</h2>
          <p className="page-description">
            Build branded forms once — contracts, documents, invoices — then
            send them to a project for the client to fill out and sign.
          </p>
        </div>
      </header>

      {formError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(formError)}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Form metrics">
        <MetricCard label="Active forms" value={String(active.length)} detail="Ready to send" tone="violet" />
        <MetricCard
          label="Invoice forms"
          value={String(active.filter((t) => t.category === "invoice").length)}
          detail="Billable line items"
          tone="pink"
        />
        <MetricCard label="Awaiting clients" value={String(pending)} detail="Sent, not yet filled" tone="cyan" />
        <MetricCard label="Submitted" value={String(submissions.filter((s) => s.status === "submitted").length)} detail="Filled + signed" tone="green" />
      </section>

      <section className="panel" aria-label="New form" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>New form</h3>
        </div>
        <form action={createFormTemplate} className="delivery-add-form">
          <input type="text" name="name" placeholder="Form name…" required maxLength={160} />
          <select name="category" defaultValue="contract" aria-label="Category">
            <option value="contract">Contract</option>
            <option value="document">Document</option>
            <option value="invoice">Invoice</option>
          </select>
          <input type="text" name="description" placeholder="What is this form for? (optional)" maxLength={280} />
          <button type="submit" className="mini-button go">Build</button>
        </form>
      </section>

      <section className="panel" aria-label="Forms">
        <div className="panel-heading">
          <h3>Forms</h3>
          <span style={{ display: "flex", gap: 8 }}>
            <Link href="/forms" className="mini-button">All</Link>
            <Link href="/forms?category=contract" className="mini-button">Contracts</Link>
            <Link href="/forms?category=document" className="mini-button">Documents</Link>
            <Link href="/forms?category=invoice" className="mini-button">Invoices</Link>
          </span>
        </div>
        <ul className="delivery-list">
          {shown.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No forms yet. Build your first one — your branded docs are the content source.</p>
            </li>
          ) : (
            shown.map((t) => (
              <li key={t.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">
                    <Link href={`/forms/${t.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {t.name}
                    </Link>
                  </p>
                  <p className="delivery-row-sub">
                    {categoryLabel(t.category)}
                    {t.description ? ` · ${t.description}` : ""} ·{" "}
                    {Array.isArray(t.fields) ? t.fields.length : 0} fields
                  </p>
                </div>
                <span className="delivery-pill visible">{categoryLabel(t.category)}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
