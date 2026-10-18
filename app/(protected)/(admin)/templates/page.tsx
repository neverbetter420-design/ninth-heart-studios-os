import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import {
  DocumentCreate,
  DocumentNav,
  DocumentNotice,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { categoryLabel, isTemplateCategory } from "@/lib/templates";
import { createClient } from "@/lib/supabase/server";
import type { Template } from "@/lib/supabase/types";
import { createTemplate } from "./actions";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string; state?: string }>;
}) {
  const { error: formError, category, state } = await searchParams;
  const supabase = await createClient();
  const { data: raw, error } = await supabase
    .from("templates")
    .select("id, name, category, content, active, created_at, updated_at")
    .order("updated_at", { ascending: false });
  const templates = (error ? [] : (raw ?? [])) as Template[];
  const active = templates.filter((t) => t.active);
  const archived = state === "archived";
  const filter = isTemplateCategory(category) ? category : undefined;
  const shown = templates.filter(
    (t) => t.active !== archived && (!filter || t.category === filter),
  );
  return (
    <div className="content-wrap management-page paperwork-page">
      <header className="page-header management-heading paperwork-heading">
        <div>
          <p className="eyebrow">The studio library</p>
          <h2>
            Written once.
            <br />
            <em>Made yours, every time.</em>
          </h2>
          <p className="page-description">
            Keep reusable contract terms and document copy ready for the next
            project. Use Fillable forms when clients need to answer questions.
          </p>
        </div>
      </header>
      <DocumentNav current="templates" />
      <section className="metric-grid" aria-label="Template metrics">
        <MetricCard
          label="Active templates"
          value={error ? "—" : String(active.length)}
          detail="Reusable studio copy"
          tone="violet"
        />
        <MetricCard
          label="Contract templates"
          value={
            error
              ? "—"
              : String(active.filter((t) => t.category === "contract").length)
          }
          detail="Ready for a draft"
          tone="pink"
        />
        <MetricCard
          label="Archived"
          value={
            error ? "—" : String(templates.filter((t) => !t.active).length)
          }
          detail="Available to restore"
          tone="cyan"
        />
      </section>
      {formError ? <DocumentNotice>{formError}</DocumentNotice> : null}
      <DocumentCreate
        title="New template"
        detail="Reusable terms, welcome notes or handoff copy"
        open={Boolean(formError)}
      >
        <form action={createTemplate} className="paperwork-form">
          <div className="paperwork-form-grid">
            <label className="field">
              <span>Template name</span>
              <input name="name" required maxLength={160} />
            </label>
            <label className="field">
              <span>Category</span>
              <select name="category" defaultValue="contract">
                <option value="contract">Contract</option>
                <option value="document">Document</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Reusable text</span>
            <textarea
              name="body"
              className="paperwork-short-editor"
              placeholder="Scope, welcome notes or a handoff checklist…"
            />
          </label>
          <div>
            <PortalSubmitButton pendingLabel="Creating template…">
              Create template
            </PortalSubmitButton>
          </div>
        </form>
      </DocumentCreate>
      <section aria-label="Templates">
        <DocumentSectionHeading
          eyebrow="Text directory"
          title={
            archived ? "From the archive" : "A starting point for good work"
          }
          detail={
            error
              ? "Unavailable"
              : `${shown.length} ${shown.length === 1 ? "template" : "templates"}`
          }
        />
        <nav className="paperwork-filters" aria-label="Template availability">
          {[
            [false, "Active"],
            [true, "Archived"],
          ].map(([inactive, label]) => (
            <Link
              key={String(inactive)}
              href={`/templates?${new URLSearchParams({ ...(filter ? { category: filter } : {}), ...(inactive ? { state: "archived" } : {}) })}`}
              aria-current={archived === inactive ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <nav className="paperwork-filters" aria-label="Template category">
          {[
            ["", "All categories"],
            ["contract", "Contracts"],
            ["document", "Documents"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/templates?${new URLSearchParams({ ...(key ? { category: key } : {}), ...(archived ? { state: "archived" } : {}) })}`}
              aria-current={(filter ?? "") === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        {error ? (
          <DocumentNotice>
            Templates could not load. Refresh to try again.
          </DocumentNotice>
        ) : shown.length === 0 ? (
          <div className="management-empty">
            <h4>
              {archived
                ? "Nothing in the archive."
                : "Your best words belong here."}
            </h4>
            <p>
              {archived
                ? "Archived templates remain available to open and restore."
                : "Create a text template and use it as the starting point for contracts or project documents."}
            </p>
          </div>
        ) : (
          <ol className="paperwork-list">
            {shown.map((t, i) => (
              <li key={t.id} className="paperwork-row">
                <span className="paperwork-number" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4>{t.name}</h4>
                  <p>
                    {categoryLabel(t.category)} · Updated{" "}
                    {documentDate(t.updated_at)}
                  </p>
                </div>
                <span className="paperwork-status">
                  {t.active ? "Active" : "Archived"}
                </span>
                <Link
                  href={`/templates/${t.id}`}
                  className="management-text-link"
                  aria-label={`Open template: ${t.name}`}
                >
                  Open template <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
