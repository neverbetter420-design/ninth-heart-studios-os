import {
  createDocumentWithFeedback,
  deleteDocumentWithFeedback,
} from "@/app/(protected)/(admin)/projects/actions";
import type { ProjectDocument } from "@/lib/supabase/types";
import { PortalActionForm } from "@/components/portal/PortalActionForm";

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

function safeLink(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
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
              {safeLink(doc.external_url) ? (
                <a
                  href={safeLink(doc.external_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mini-button"
                >
                  Open
                </a>
              ) : null}
              <div className="delivery-actions">
                <PortalActionForm action={deleteDocumentWithFeedback} pendingMessage="Removing document…" confirmMessage={`Remove “${doc.title}” from this project? The original linked document and uploaded files will be kept.`}>
                  <input type="hidden" name="document_id" value={doc.id} />
                  <input type="hidden" name="project_id" value={projectId} />
                  <button type="submit" className="mini-button danger" aria-label={`Delete ${doc.title}`}>✕</button>
                </PortalActionForm>
              </div>
            </li>
          ))
        )}
      </ul>
      <PortalActionForm action={createDocumentWithFeedback} pendingMessage="Sharing document…" lockOnSuccess={false} resetOnSuccess className="delivery-add-form">
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
      </PortalActionForm>
    </section>
  );
}
