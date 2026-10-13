import Link from "next/link";
import { notFound } from "next/navigation";
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

  const { data: raw } = await supabase
    .from("templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!raw) notFound();
  const template = raw as Template;

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/templates" className="text-button">← Templates</Link>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow electric">Template · {categoryLabel(template.category)}</p>
          <h2>{template.name}</h2>
        </div>
        <div className="delivery-actions">
          <form action={setTemplateActive}>
            <input type="hidden" name="template_id" value={template.id} />
            <input type="hidden" name="active" value={template.active ? "false" : "true"} />
            <button type="submit" className="mini-button">
              {template.active ? "Archive" : "Restore"}
            </button>
          </form>
          <form action={deleteTemplate}>
            <input type="hidden" name="template_id" value={template.id} />
            <button type="submit" className="mini-button danger">Delete</button>
          </form>
        </div>
      </header>

      <section className="panel" aria-label="Edit template">
        <div className="panel-heading">
          <h3>Edit</h3>
          {!template.active ? <span className="pipeline-count">Archived</span> : null}
        </div>
        <form action={updateTemplate} style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="template_id" value={template.id} />
          <div className="delivery-add-form" style={{ padding: 0 }}>
            <input type="text" name="name" defaultValue={template.name} required maxLength={160} />
            <select name="category" defaultValue={template.category} aria-label="Category">
              <option value="contract">Contract</option>
              <option value="document">Document</option>
            </select>
          </div>
          <label className="field">
            <span>Body</span>
            <textarea
              name="body"
              className="notes-area"
              style={{ minHeight: 320 }}
              defaultValue={templateBody(template.content)}
            />
          </label>
          <div>
            <button type="submit" className="mini-button go">Save</button>
          </div>
        </form>
      </section>
    </div>
  );
}
