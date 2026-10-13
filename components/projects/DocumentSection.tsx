import {
  createDocument,
  deleteDocument,
} from "@/app/(protected)/(admin)/projects/actions";
import type { ProjectDocument } from "@/lib/supabase/types";

const KINDS = [
  { value: "contract", label: "Contract" },
  { value: "proposal", label: "Proposal" },
  { value: "invoice", label: "Invoice" },
  { value: "handoff", label: "Handoff" },
  { value: "other", label: "Other" },
] as const;

function kindLabel(kind: string) {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function DocumentSection({
  projectId,
  documents,
  docTemplates = [],
}: {
  projectId: string;
  documents: ProjectDocument[];
  docTemplates?: { id: string; name: string }[];
}) {
  return (
    <section className="panel" aria-label="Documents">
      <div className="panel-heading">
        <h3>Documents</h3>
        <span className="pipeline-count">{documents.length}</span>
      </div>
      <ul className="delivery-list">
        {documents.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">No documents shared. Contracts, proposals, invoices live here.</p>
          </li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{doc.title}</p>
                <p className="delivery-row-sub">
                  {kindLabel(doc.kind)}
                  {doc.notes ? ` · ${doc.notes}` : ""}
                </p>
              </div>
              {doc.external_url ? (
                <a
                  href={doc.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mini-button"
                >
                  Open
                </a>
              ) : null}
              <div className="delivery-actions">
                <form action={deleteDocument}>
                  <input type="hidden" name="document_id" value={doc.id} />
                  <button type="submit" className="mini-button danger" aria-label={`Delete ${doc.title}`}>✕</button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>
      <form action={createDocument} className="delivery-add-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="text" name="title" placeholder="Document title…" required maxLength={160} />
        <select name="kind" defaultValue="other" aria-label="Document kind">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        {docTemplates.length > 0 ? (
          <select name="template_id" defaultValue="" aria-label="Template">
            <option value="">No template…</option>
            {docTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        ) : null}
        <input type="url" name="external_url" placeholder="Link (optional)…" maxLength={500} />
        <input type="text" name="notes" placeholder="Notes (optional — template fills this)…" maxLength={280} />
        <button type="submit" className="mini-button go">Share</button>
      </form>
    </section>
  );
}
