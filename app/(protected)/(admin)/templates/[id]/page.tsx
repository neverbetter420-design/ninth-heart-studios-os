import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DocumentNav,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import { categoryLabel, templateBody } from "@/lib/templates";
import { createClient } from "@/lib/supabase/server";
import type { Template } from "@/lib/supabase/types";
import { deleteTemplate, setTemplateActive, updateTemplate } from "../actions";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: raw, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Template could not load.");
  if (!raw) notFound();
  const template = raw as Template;
  return (
    <div className="content-wrap management-page paperwork-page paperwork-detail">
      <Link
        href={template.active ? "/templates" : "/templates?state=archived"}
        className="management-back-link"
      >
        ← Text templates
      </Link>
      <header className="page-header management-heading paperwork-heading">
        <div>
          <p className="eyebrow">
            Text template · {categoryLabel(template.category)} ·{" "}
            {template.active ? "Active" : "Archived"}
          </p>
          <h2>{template.name}</h2>
          <p className="page-description">
            A starting point for the next project. Changes here do not rewrite
            agreements or documents already created from this text.
          </p>
        </div>
      </header>
      <DocumentNav current="templates" />
      <div className="paperwork-workspace">
        <section aria-label="Edit template">
          <DocumentSectionHeading
            eyebrow="Reusable studio copy"
            title="The writing room"
          />
          <form action={updateTemplate} className="paperwork-form">
            <input type="hidden" name="template_id" value={template.id} />
            <div className="paperwork-form-grid">
              <label className="field">
                <span>Template name</span>
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
                </select>
              </label>
            </div>
            <label className="field">
              <span>Reusable text</span>
              <textarea
                aria-label="Reusable text"
                name="body"
                className="paperwork-body-editor"
                defaultValue={templateBody(template.content)}
              />
            </label>
            <div>
              <PortalSubmitButton pendingLabel="Saving template…">
                Save template
              </PortalSubmitButton>
            </div>
          </form>
        </section>
        <aside className="paperwork-context">
          <section aria-label="Template availability">
            <DocumentSectionHeading title="In the library" />
            <dl className="paperwork-metadata">
              <div>
                <dt>Availability</dt>
                <dd>{template.active ? "Active" : "Archived"}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{documentDate(template.updated_at, true)}</dd>
              </div>
            </dl>
            <p>
              {template.active
                ? "Available in matching contract and project-document template choices."
                : "Restore this template to make it available for new work."}
            </p>
            <form action={setTemplateActive}>
              <input type="hidden" name="template_id" value={template.id} />
              <input
                type="hidden"
                name="active"
                value={template.active ? "false" : "true"}
              />
              <PortalSubmitButton
                pendingLabel={template.active ? "Archiving…" : "Restoring…"}
              >
                {template.active ? "Archive template" : "Restore template"}
              </PortalSubmitButton>
            </form>
          </section>
          <details className="paperwork-controls">
            <summary>Record controls</summary>
            <p>
              Delete permanently removes this text template from the library.
            </p>
            <div className="paperwork-control-actions">
              <form action={deleteTemplate}>
                <input type="hidden" name="template_id" value={template.id} />
                <PortalSubmitButton
                  pendingLabel="Deleting…"
                  className="mini-button danger"
                >
                  Delete template
                </PortalSubmitButton>
              </form>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
