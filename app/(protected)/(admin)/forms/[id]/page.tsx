import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel, fieldTypeLabel, parseFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { FormSubmission, FormTemplate } from "@/lib/supabase/types";
import {
  addFormField,
  deleteFormField,
  deleteFormTemplate,
  sendFormToProject,
  setFormTemplateActive,
  updateFormTemplate,
} from "../actions";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: raw }, { data: rawProjects }, { data: rawSubmissions }] = await Promise.all([
    supabase.from("form_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("form_submissions")
      .select("id, project_id, status, submitted_at, signer_name, total_cents, created_at")
      .eq("template_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!raw) notFound();
  const template = raw as FormTemplate;
  const fields = parseFields(template.fields);
  const submissions = (rawSubmissions ?? []) as FormSubmission[];

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/forms" className="text-button">← Forms</Link>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow electric">Form · {categoryLabel(template.category)}</p>
          <h2>{template.name}</h2>
        </div>
        <div className="delivery-actions">
          <form action={setFormTemplateActive}>
            <input type="hidden" name="template_id" value={template.id} />
            <input type="hidden" name="active" value={template.active ? "false" : "true"} />
            <button type="submit" className="mini-button">
              {template.active ? "Archive" : "Restore"}
            </button>
          </form>
          <form action={deleteFormTemplate}>
            <input type="hidden" name="template_id" value={template.id} />
            <button type="submit" className="mini-button danger">Delete</button>
          </form>
        </div>
      </header>

      <section className="panel" aria-label="Form details" style={{ marginBottom: 14 }}>
        <form action={updateFormTemplate} style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="template_id" value={template.id} />
          <div className="delivery-add-form" style={{ padding: 0 }}>
            <input type="text" name="name" defaultValue={template.name} required maxLength={160} />
            <select name="category" defaultValue={template.category} aria-label="Category">
              <option value="contract">Contract</option>
              <option value="document">Document</option>
              <option value="invoice">Invoice</option>
            </select>
          </div>
          <label className="field">
            <span>Description</span>
            <input type="text" name="description" defaultValue={template.description} maxLength={280} />
          </label>
          <div>
            <button type="submit" className="mini-button go">Save</button>
          </div>
        </form>
      </section>

      <section className="panel" aria-label="Fields" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>Fields</h3>
          <span className="pipeline-count">{fields.length}</span>
        </div>
        <ul className="delivery-list">
          {fields.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No fields yet. Add the first one below — every business form starts with a name and a checkbox.</p>
            </li>
          ) : (
            fields.map((f) => (
              <li key={f.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">{f.label}</p>
                  <p className="delivery-row-sub">
                    {fieldTypeLabel(f.type)}
                    {f.required ? " · Required" : ""}{" "}
                    {f.options ? `· Options: ${f.options.join(", ")}` : ""}
                    {f.help ? ` · ${f.help}` : ""}
                  </p>
                </div>
                <form action={deleteFormField}>
                  <input type="hidden" name="template_id" value={template.id} />
                  <input type="hidden" name="field_id" value={f.id} />
                  <button type="submit" className="mini-button danger" aria-label={`Delete ${f.label}`}>✕</button>
                </form>
              </li>
            ))
          )}
        </ul>
        <form action={addFormField} style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="template_id" value={template.id} />
          <div className="delivery-add-form" style={{ padding: 0 }}>
            <input type="text" name="label" placeholder="Field label… e.g. Full name, Agree to terms, Due date" required maxLength={120} />
            <select name="type" defaultValue="text" aria-label="Field type">
              <option value="text">Short text</option>
              <option value="textarea">Long text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="checkbox">Checkbox</option>
              <option value="select">Dropdown</option>
              <option value="signature">Signature</option>
              <option value="line_items">Line items (invoice)</option>
            </select>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="required" /> Required
            </label>
          </div>
          <input type="text" name="options" placeholder="Dropdown options, comma-separated (dropdown only)" maxLength={500} />
          <input type="text" name="help" placeholder="Help text shown under the field (optional)" maxLength={280} />
          <div>
            <button type="submit" className="mini-button go">Add field</button>
          </div>
        </form>
      </section>

      <section className="panel" aria-label="Send form" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>Send to a project</h3>
        </div>
        <form action={sendFormToProject} className="delivery-add-form">
          <input type="hidden" name="template_id" value={template.id} />
          <select name="project_id" required defaultValue="" aria-label="Project" style={{ flex: 1 }}>
            <option value="" disabled>Choose a project…</option>
            {((rawProjects ?? []) as { id: string; name: string }[]).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button type="submit" className="mini-button go">Send form</button>
        </form>
      </section>

      <section className="panel" aria-label="Submissions">
        <div className="panel-heading">
          <h3>Submissions</h3>
          <span className="pipeline-count">{submissions.length}</span>
        </div>
        <ul className="delivery-list">
          {submissions.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">Nothing sent yet.</p>
            </li>
          ) : (
            submissions.map((s) => (
              <li key={s.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">
                    {s.status === "submitted" && s.signer_name ? `Signed by ${s.signer_name}` : "Awaiting client"}
                  </p>
                  <p className="delivery-row-sub">
                    {s.status === "submitted" && s.submitted_at
                      ? `Submitted ${new Date(s.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : `Sent ${new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    {s.total_cents !== null && s.total_cents !== undefined ? ` · Total $${(s.total_cents / 100).toFixed(2)}` : ""}
                  </p>
                </div>
                <span className={`delivery-pill ${s.status === "submitted" ? "done" : "progress"}`}>{s.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
