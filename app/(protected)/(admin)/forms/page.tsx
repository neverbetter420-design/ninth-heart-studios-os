import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import {
  DocumentCreate,
  DocumentNav,
  DocumentNotice,
  DocumentSectionHeading,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { categoryLabel, isFormCategory, parseFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { FormSubmission, FormTemplate } from "@/lib/supabase/types";
import { createFormTemplate, importPdfForm } from "./actions";

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; category?: string; state?: string }>;
}) {
  const { error: formError, category, state } = await searchParams;
  const supabase = await createClient();
  const [
    { data: rawTemplates, error },
    { data: rawSubmissions, error: submissionsError },
  ] = await Promise.all([
    supabase
      .from("form_templates")
      .select(
        "id, name, category, description, fields, active, created_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("form_submissions")
      .select("id, status")
      .order("created_at", { ascending: false }),
  ]);
  const templates = (error ? [] : (rawTemplates ?? [])) as FormTemplate[];
  const submissions = (
    submissionsError ? [] : (rawSubmissions ?? [])
  ) as FormSubmission[];
  const archived = state === "archived";
  const filter = isFormCategory(category) ? category : undefined;
  const shown = templates.filter(
    (t) => t.active !== archived && (!filter || t.category === filter),
  );
  const categoryHref = (key: string) =>
    `/forms?${new URLSearchParams({ ...(key ? { category: key } : {}), ...(archived ? { state: "archived" } : {}) })}`;
  return (
    <div className="content-wrap management-page paperwork-page">
      <header className="page-header management-heading paperwork-heading">
        <div>
          <p className="eyebrow">Client paperwork</p>
          <h2>
            A little structure.
            <br />
            <em>A clearer answer.</em>
          </h2>
          <p className="page-description">
            Build a fillable form, review its fields, and collect responses
            through the client workspace.
          </p>
        </div>
      </header>
      <DocumentNav current="forms" />
      <section className="metric-grid" aria-label="Form metrics">
        <MetricCard
          label="Active forms"
          value={error ? "—" : String(templates.filter((t) => t.active).length)}
          detail="Available to send"
          tone="violet"
        />
        <MetricCard
          label="Awaiting clients"
          value={
            submissionsError
              ? "—"
              : String(submissions.filter((s) => s.status === "pending").length)
          }
          detail="Pending responses"
          tone="pink"
        />
        <MetricCard
          label="Submitted"
          value={
            submissionsError
              ? "—"
              : String(
                  submissions.filter((s) => s.status === "submitted").length,
                )
          }
          detail="Responses received"
          tone="cyan"
        />
      </section>
      {formError ? <DocumentNotice>{formError}</DocumentNotice> : null}
      {submissionsError ? (
        <DocumentNotice>
          Submission counts could not load. Refresh to try again.
        </DocumentNotice>
      ) : null}
      <DocumentCreate
        title="New form"
        detail="Start with your own fields"
        open={Boolean(formError)}
      >
        <form action={createFormTemplate} className="paperwork-form">
          <div className="paperwork-form-grid">
            <label className="field">
              <span>Form name</span>
              <input
                name="name"
                required
                maxLength={160}
                placeholder="Website project intake"
              />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                aria-label="Category"
                name="category"
                defaultValue="contract"
              >
                <option value="contract">Contract</option>
                <option value="document">Document</option>
                <option value="invoice">Invoice</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>Description (optional)</span>
            <input name="description" maxLength={280} />
          </label>
          <div>
            <PortalSubmitButton pendingLabel="Creating form…">
              Create form
            </PortalSubmitButton>
          </div>
        </form>
      </DocumentCreate>
      <DocumentCreate
        title="Import PDF"
        detail="Bring in a Canva or Google Docs original"
        open={Boolean(formError)}
      >
        <form action={importPdfForm} className="paperwork-form">
          <div className="paperwork-form-grid">
            <label className="field">
              <span>Imported form name</span>
              <input name="name" required maxLength={160} />
            </label>
            <label className="field">
              <span>Category</span>
              <select
                aria-label="Category"
                name="category"
                defaultValue="contract"
              >
                <option value="contract">Contract</option>
                <option value="document">Document</option>
                <option value="invoice">Invoice</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>PDF file · up to 25 MB</span>
            <input
              type="file"
              name="pdf"
              accept="application/pdf,.pdf"
              required
            />
          </label>
          <p className="management-help">
            Download your Canva or Google Docs design as a PDF. Existing form
            fields are imported; fields detected in a flat PDF need review.
            Imports stay inactive until you activate them in the builder.
          </p>
          <div>
            <PortalSubmitButton pendingLabel="Importing PDF…">
              Import PDF
            </PortalSubmitButton>
          </div>
        </form>
      </DocumentCreate>
      <section aria-label="Forms">
        <DocumentSectionHeading
          eyebrow="Form directory"
          title={
            archived ? "Inactive & archived forms" : "Ready for a response"
          }
          detail={
            error
              ? "Unavailable"
              : `${shown.length} ${shown.length === 1 ? "form" : "forms"}`
          }
        />
        <nav className="paperwork-filters" aria-label="Form availability">
          {[
            [false, "Active"],
            [true, "Inactive & archived"],
          ].map(([inactive, label]) => (
            <Link
              key={String(inactive)}
              href={`/forms?${new URLSearchParams({ ...(filter ? { category: filter } : {}), ...(inactive ? { state: "archived" } : {}) })}`}
              aria-current={archived === inactive ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <nav className="paperwork-filters" aria-label="Form category">
          {[
            ["", "All categories"],
            ["contract", "Contracts"],
            ["document", "Documents"],
            ["invoice", "Invoices"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={categoryHref(key)}
              aria-current={(filter ?? "") === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        {error ? (
          <DocumentNotice>
            Forms could not load. Refresh to try again.
          </DocumentNotice>
        ) : shown.length === 0 ? (
          <div className="management-empty">
            <h4>
              {archived
                ? "No inactive forms here."
                : "Make room for the right questions."}
            </h4>
            <p>
              {archived
                ? "New PDF imports and archived forms will be available here for review."
                : "Create a form or import a PDF, then review it in the builder."}
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
                    {categoryLabel(t.category)} · {parseFields(t.fields).length}{" "}
                    fields{t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <span className="paperwork-status">
                  {t.active ? "Active" : "Inactive"}
                </span>
                <Link
                  href={`/forms/${t.id}`}
                  className="management-text-link"
                  aria-label={`Open form: ${t.name}`}
                >
                  Open builder <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
