import {
  createProposal,
  deleteProposal,
  markProposalSent,
  updateProposal,
} from "@/app/(protected)/(admin)/opportunities/actions";
import {
  DocumentCreate,
  DocumentNotice,
  DocumentSectionHeading,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
import type { Proposal } from "@/lib/supabase/types";

export function ProposalSection({
  opportunityId,
  proposals,
  unavailable = false,
}: {
  opportunityId: string;
  proposals: Proposal[];
  unavailable?: boolean;
}) {
  return (
    <section
      id="radar-proposals"
      aria-label="Proposal workspace"
      className="radar-section"
    >
      <DocumentSectionHeading
        eyebrow="02 · The pitch"
        title="Write with intention."
        detail={
          unavailable
            ? "Drafts unavailable"
            : `${proposals.length} ${proposals.length === 1 ? "proposal" : "proposals"}`
        }
      />
      <p className="management-help">
        Draft and keep a record here. Send through your chosen channel;
        recording a proposal as sent does not deliver it.
      </p>
      {unavailable ? (
        <DocumentNotice>
          Proposal drafts could not load. Refresh before creating another draft.
        </DocumentNotice>
      ) : (
        <>
          {proposals.length ? (
            proposals.map((p) => (
              <details
                key={p.id}
                className="studio-saved-draft radar-proposal"
                data-proposal-id={p.id}
              >
                <summary>
                  <span>
                    <strong>{p.title}</strong>
                    <small>
                      {p.status === "sent" ? "Recorded as sent" : "Draft"} ·
                      Updated {documentDate(p.updated_at)}
                    </small>
                  </span>
                  <span aria-hidden="true">+</span>
                </summary>
                {p.status === "sent" ? (
                  <div className="studio-draft-body">
                    {p.content || "No proposal text recorded."}
                  </div>
                ) : (
                  <>
                    <form
                      action={updateProposal}
                      className="radar-proposal-editor"
                    >
                      <input type="hidden" name="proposal_id" value={p.id} />
                      <label className="field">
                        <span>Proposal title</span>
                        <input
                          name="title"
                          aria-label="Proposal title"
                          defaultValue={p.title}
                          maxLength={160}
                        />
                      </label>
                      <label className="field">
                        <span>Proposal text</span>
                        <textarea
                          name="content"
                          aria-label="Proposal text"
                          rows={9}
                          defaultValue={p.content}
                          placeholder="Scope, timeline, price, and why NHS…"
                        />
                      </label>
                      <div className="studio-actions">
                        <PortalSubmitButton pendingLabel="Saving draft…">
                          Save proposal draft
                        </PortalSubmitButton>
                      </div>
                    </form>
                    <div className="studio-actions">
                      <form action={markProposalSent}>
                        <input type="hidden" name="proposal_id" value={p.id} />
                        <PortalSubmitButton pendingLabel="Recording…">
                          Record as sent
                        </PortalSubmitButton>
                      </form>
                      <details className="radar-delete">
                        <summary>Delete this draft</summary>
                        <p className="management-help">
                          Permanently removes this proposal draft.
                        </p>
                        <form action={deleteProposal}>
                          <input
                            type="hidden"
                            name="proposal_id"
                            value={p.id}
                          />
                          <PortalSubmitButton
                            className="mini-button danger"
                            pendingLabel="Deleting…"
                          >
                            Delete proposal draft
                          </PortalSubmitButton>
                        </form>
                      </details>
                    </div>
                  </>
                )}
              </details>
            ))
          ) : (
            <div className="management-empty">
              <h4>A blank page, with a purpose.</h4>
              <p>Create a draft when the opportunity deserves the time.</p>
            </div>
          )}
          <DocumentCreate
            title="Create a proposal draft"
            detail="Your voice. Your scope. Your terms."
          >
            <form action={createProposal} className="radar-stage-form">
              <input
                type="hidden"
                name="opportunity_id"
                value={opportunityId}
              />
              <label className="field">
                <span>New proposal title</span>
                <input
                  name="title"
                  maxLength={160}
                  placeholder="Website design proposal"
                />
              </label>
              <PortalSubmitButton pendingLabel="Creating draft…">
                Create draft
              </PortalSubmitButton>
            </form>
          </DocumentCreate>
        </>
      )}
    </section>
  );
}
