import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DocumentNav,
  DocumentNotice,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
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
  const [
    { data: raw, error },
    { data: rawProjects, error: projectsError },
    { data: rawSubmissions, error: submissionsError },
  ] = await Promise.all([
    supabase.from("form_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("projects").select("id, name").order("name"),
    supabase
      .from("form_submissions")
      .select(
        "id, project_id, status, submitted_at, signer_name, total_cents, created_at",
      )
      .eq("template_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error("Form could not load.");
  if (!raw) notFound();
  const template = raw as FormTemplate;
  const fields = parseFields(template.fields);
  const submissions = (
    submissionsError ? [] : (rawSubmissions ?? [])
  ) as FormSubmission[];
  const projects = (projectsError ? [] : (rawProjects ?? [])) as {
    id: string;
    name: string;
  }[];
  const names = new Map(projects.map((p) => [p.id, p.name]));
  let sourceUrl: string | null = null;
  if (template.source_file_path) {
    const { data: signed } = await supabase.storage
      .from("form-sources")
      .createSignedUrl(template.source_file_path, 3600);
    sourceUrl = signed?.signedUrl ?? null;
  }
  const cannotSend =
    !template.active || Boolean(projectsError) || projects.length === 0;
  return (
    <div className="content-wrap management-page paperwork-page paperwork-detail">
      <Link
        href={template.active ? "/forms" : "/forms?state=archived"}
        className="management-back-link"
      >
        ← Fillable forms
      </Link>
      <header className="page-header management-heading paperwork-heading">
        <div>
          <p className="eyebrow">
            Form builder · {categoryLabel(template.category)} ·{" "}
            {template.active ? "Active" : "Inactive"}
          </p>
          <h2>{template.name}</h2>
          <p className="page-description">
            Give every question a purpose. Review the fields before making the
            form available to a client.
          </p>
        </div>
      </header>
      <DocumentNav current="forms" />
      <nav
        className="management-destinations"
        aria-label="Form workspace destinations"
      >
        <a href="#form-fields">Fields</a>
        <a href="#form-details">Form details</a>
        <a href="#form-send">Send to a project</a>
        <a href="#form-submissions">Submissions</a>
      </nav>
      <div className="paperwork-workspace">
        <div className="paperwork-main">
          <section id="form-fields" aria-label="Fields">
            <DocumentSectionHeading
              eyebrow="Build the conversation"
              title="The questions"
              detail={`${fields.length} ${fields.length === 1 ? "field" : "fields"}`}
            />
            {fields.length === 0 ? (
              <div className="management-empty">
                <h4>Start with what you need to know.</h4>
                <p>
                  Add fields below. Text, choices, dates, signatures and invoice
                  line items are available.
                </p>
              </div>
            ) : (
              <ol className="paperwork-list">
                {fields.map((f, i) => (
                  <li key={f.id} className="paperwork-field-row">
                    <span className="paperwork-number" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h4>{f.label}</h4>
                      <p>
                        {fieldTypeLabel(f.type)} ·{" "}
                        {f.required ? "Required" : "Optional"}
                      </p>
                      {f.options?.length ? (
                        <p>Choices: {f.options.join(", ")}</p>
                      ) : null}
                      {f.help ? <p>{f.help}</p> : null}
                    </div>
                    <form action={deleteFormField}>
                      <input
                        type="hidden"
                        name="template_id"
                        value={template.id}
                      />
                      <input type="hidden" name="field_id" value={f.id} />
                      <PortalSubmitButton
                        pendingLabel="Removing…"
                        className="mini-button danger"
                      >
                        Remove field {i + 1}
                      </PortalSubmitButton>
                    </form>
                  </li>
                ))}
              </ol>
            )}
            <details className="paperwork-add-field" open={fields.length === 0}>
              <summary>Add a field</summary>
              <form action={addFormField} className="paperwork-form">
                <input type="hidden" name="template_id" value={template.id} />
                <label className="field">
                  <span>Field label</span>
                  <input
                    name="label"
                    required
                    maxLength={120}
                    placeholder="Full name, business goals, due date…"
                  />
                </label>
                <div className="paperwork-form-grid">
                  <label className="field">
                    <span>Field type</span>
                    <select
                      aria-label="Field type"
                      name="type"
                      defaultValue="text"
                    >
                      <option value="text">Short text</option>
                      <option value="textarea">Long text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="select">Dropdown</option>
                      <option value="signature">Signature</option>
                      <option value="line_items">Line items (invoice)</option>
                    </select>
                  </label>
                  <label className="paperwork-checkbox">
                    <input type="checkbox" name="required" />
                    Required field
                  </label>
                </div>
                <label className="field">
                  <span>Dropdown options (comma-separated)</span>
                  <input
                    name="options"
                    maxLength={500}
                    placeholder="Only used for Dropdown fields"
                  />
                </label>
                <label className="field">
                  <span>Help text (optional)</span>
                  <input name="help" maxLength={280} />
                </label>
                <div>
                  <PortalSubmitButton pendingLabel="Adding field…">
                    Add field
                  </PortalSubmitButton>
                </div>
              </form>
            </details>
          </section>
          <section id="form-details" aria-label="Form details">
            <DocumentSectionHeading title="Name & context" />
            {template.source_file_path ? (
              <div className="paperwork-source">
                <p className="management-help">Original PDF reference</p>
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="management-text-link"
                  >
                    {template.source_file_name || "Open source PDF"} ↗
                  </a>
                ) : (
                  <DocumentNotice>
                    The source PDF link is unavailable. Refresh to try again.
                  </DocumentNotice>
                )}
                <p className="management-help">
                  Review imported fields against the original before activating.
                </p>
              </div>
            ) : null}
            <form action={updateFormTemplate} className="paperwork-form">
              <input type="hidden" name="template_id" value={template.id} />
              <div className="paperwork-form-grid">
                <label className="field">
                  <span>Form name</span>
                  <input
                    name="name"
                    defaultValue={template.name}
                    required
                    maxLength={160}
                  />
                </label>
                <label className="field">
                  <span>Category</span>
                  <select
                    aria-label="Category"
                    name="category"
                    defaultValue={template.category}
                  >
                    <option value="contract">Contract</option>
                    <option value="document">Document</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Description</span>
                <input
                  name="description"
                  defaultValue={template.description}
                  maxLength={280}
                />
              </label>
              <div>
                <PortalSubmitButton pendingLabel="Saving details…">
                  Save details
                </PortalSubmitButton>
              </div>
            </form>
          </section>
          <section id="form-submissions" aria-label="Submissions">
            <DocumentSectionHeading
              eyebrow="The response record"
              title="Sent & submitted"
              detail={
                submissionsError
                  ? "Unavailable"
                  : `${submissions.length} ${submissions.length === 1 ? "record" : "records"}`
              }
            />
            {submissionsError ? (
              <DocumentNotice>
                Submissions could not load. Refresh to try again.
              </DocumentNotice>
            ) : submissions.length === 0 ? (
              <p className="management-help">
                Nothing sent yet. Send the active form to a project when it is
                ready.
              </p>
            ) : (
              <ul className="paperwork-list">
                {submissions.map((s) => (
                  <li key={s.id} className="paperwork-submission">
                    <div>
                      <h4>
                        {s.status === "submitted"
                          ? `Submitted${s.signer_name ? ` by ${s.signer_name}` : ""}`
                          : s.status === "pending"
                            ? "Awaiting client"
                            : s.status}
                      </h4>
                      <Link
                        href={`/projects/${s.project_id}?section=documents#workspace-resources`}
                        className="management-text-link"
                      >
                        {names.get(s.project_id) || "Open project"} ↗
                      </Link>
                      <p>
                        {s.status === "submitted"
                          ? `Submitted ${documentDate(s.submitted_at)}`
                          : `Sent ${documentDate(s.created_at)}`}
                        {s.total_cents != null
                          ? ` · Total $${(s.total_cents / 100).toFixed(2)}`
                          : ""}
                      </p>
                    </div>
                    <span className="paperwork-status" data-status={s.status}>
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="paperwork-context">
          <section id="form-send" aria-label="Send form">
            <DocumentSectionHeading title="Send to a project" />
            <p>
              The client receives a pending form in their project workspace.
              This action does not send an email.
            </p>
            {!template.active ? (
              <p className="management-help">
                This form is inactive. Review its fields, then activate it below
                before sending.
              </p>
            ) : null}
            {projectsError ? (
              <DocumentNotice>
                Project choices could not load. Refresh before sending.
              </DocumentNotice>
            ) : projects.length === 0 ? (
              <p className="management-help">
                Create a <Link href="/projects">project</Link> before sending a
                form.
              </p>
            ) : null}
            <form action={sendFormToProject} className="paperwork-form">
              <input type="hidden" name="template_id" value={template.id} />
              <fieldset className="paperwork-fieldset" disabled={cannotSend}>
                <label className="field">
                  <span>Project</span>
                  <select
                    aria-label="Project"
                    name="project_id"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a project
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <PortalSubmitButton pendingLabel="Sending form…">
                    Send form
                  </PortalSubmitButton>
                </div>
              </fieldset>
            </form>
          </section>
          <section aria-label="Form availability">
            <DocumentSectionHeading title="Availability" />
            <p>
              {template.active
                ? "Active · available to send"
                : "Inactive · review before activating"}
            </p>
            <form action={setFormTemplateActive}>
              <input type="hidden" name="template_id" value={template.id} />
              <input
                type="hidden"
                name="active"
                value={template.active ? "false" : "true"}
              />
              <PortalSubmitButton
                pendingLabel={template.active ? "Archiving…" : "Activating…"}
              >
                {template.active ? "Archive form" : "Activate form"}
              </PortalSubmitButton>
            </form>
          </section>
          <details className="paperwork-controls">
            <summary>Record controls</summary>
            <p>
              Deleting removes this form template and its linked submissions.
              Archive it to keep those records.
            </p>
            <div className="paperwork-control-actions">
              <form action={deleteFormTemplate}>
                <input type="hidden" name="template_id" value={template.id} />
                <PortalSubmitButton
                  pendingLabel="Deleting…"
                  className="mini-button danger"
                >
                  Delete form
                </PortalSubmitButton>
              </form>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
