import Link from "next/link";
import type { RankedLead } from "@/lib/flowkeep";

function momentumClass(state: string) {
  if (state === "Waiting on Me" || state === "New Inbound") return "momentum-hot";
  if (state.includes("Consultation")) return "momentum-consult";
  return "momentum-wait";
}

export function LeadInbox({ leads }: { leads: RankedLead[] }) {
  return (
    <section className="panel lead-inbox-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow electric">Momentum queue</p>
          <h3>Lead inbox</h3>
        </div>
        <span className="live-pill"><i /> Deterministic ranking</span>
      </div>

      {leads.length === 0 ? (
        <div className="empty-state">
          <h3>No active leads.</h3>
          <p>Capture one above. The software can rank leads, but tragically it still cannot invent customers without becoming a scam.</p>
        </div>
      ) : (
        <div className="lead-inbox-list">
          {leads.map((lead) => (
            <article className="lead-inbox-row" key={lead.id}>
              <div className={`priority-number priority-${lead.priorityLabel}`}>
                {lead.priorityScore >= 1000 ? "!" : lead.priorityScore >= 800 ? "↑" : "·"}
              </div>

              <div className="lead-primary">
                <div className="lead-name-line">
                  <strong>{lead.business_name}</strong>
                  <span className={`momentum-pill ${momentumClass(lead.momentum_state)}`}>{lead.momentum_state}</span>
                </div>
                <span>{lead.actionTitle}</span>
                <small>{lead.actionMeta}</small>
              </div>

              <div className="lead-meta-stack">
                <span>{lead.acquisition_type === "inbound" ? "Inbound" : "Outbound"}</span>
                <strong>{lead.score ?? "—"}</strong>
              </div>

              <Link href={`/leads/${lead.id}`} className="ghost-button lead-open-link">Open lead</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
