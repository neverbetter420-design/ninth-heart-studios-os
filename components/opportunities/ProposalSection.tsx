import {
  createProposal,
  deleteProposal,
  markProposalSent,
  updateProposal,
} from "@/app/(protected)/(admin)/opportunities/actions";
import type { Proposal } from "@/lib/supabase/types";

export function ProposalSection({
  opportunityId,
  proposals,
}: {
  opportunityId: string;
  proposals: Proposal[];
}) {
  return (
    <section className="panel" aria-label="Proposal workspace">
      <div className="panel-heading">
        <h3>Proposal workspace</h3>
        <span className="pipeline-count">{proposals.length}</span>
      </div>
      {proposals.length === 0 ? (
        <p className="pipeline-empty" style={{ padding: "14px 18px" }}>
          No drafts yet. Win the work before someone cheaper does.
        </p>
      ) : (
        proposals.map((p) => (
          <details key={p.id} className="panel" style={{ margin: 14, borderRadius: 12 }}>
            <summary className="panel-heading" style={{ cursor: "pointer" }}>
              <h3>{p.title}</h3>
              <span className={p.status === "sent" ? "delivery-pill done" : "delivery-pill progress"}>
                {p.status === "sent" ? "Sent" : "Draft"}
              </span>
            </summary>
            <form action={updateProposal} style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <input type="hidden" name="proposal_id" value={p.id} />
              <label className="field">
                <span>Title</span>
                <input type="text" name="title" defaultValue={p.title} maxLength={160} disabled={p.status === "sent"} />
              </label>
              <label className="field">
                <span>Draft (your voice, not a robot&apos;s)</span>
                <textarea
                  name="content"
                  className="notes-area"
                  style={{ minHeight: 160 }}
                  defaultValue={p.content}
                  disabled={p.status === "sent"}
                  placeholder="Scope, timeline, price, why NHS…"
                />
              </label>
              <div className="delivery-actions">
                {p.status === "draft" ? (
                  <>
                    <button type="submit" className="mini-button go">Save draft</button>
                  </>
                ) : null}
              </div>
            </form>
            {p.status === "draft" ? (
              <div className="delivery-actions" style={{ padding: "0 18px 18px" }}>
                <form action={markProposalSent}>
                  <input type="hidden" name="proposal_id" value={p.id} />
                  <button type="submit" className="mini-button go">Mark sent</button>
                </form>
                <form action={deleteProposal}>
                  <input type="hidden" name="proposal_id" value={p.id} />
                  <button type="submit" className="mini-button danger">Delete</button>
                </form>
              </div>
            ) : null}
          </details>
        ))
      )}
      <form action={createProposal} className="delivery-add-form">
        <input type="hidden" name="opportunity_id" value={opportunityId} />
        <input type="text" name="title" placeholder="New proposal draft…" maxLength={160} />
        <button type="submit" className="mini-button go">Draft</button>
      </form>
    </section>
  );
}
