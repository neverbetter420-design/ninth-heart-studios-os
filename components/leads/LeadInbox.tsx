import Link from "next/link";
import type { RankedLead } from "@/lib/flowkeep";

function momentumClass(state: string) {
  if (state === "Waiting on Me" || state === "New Inbound") return "momentum-hot";
  if (state.includes("Consultation")) return "momentum-consult";
  return "momentum-wait";
}

export function LeadInbox({ leads, unavailable = false }: { leads: RankedLead[]; unavailable?: boolean }) {
  return (
    <section className="lead-inbox-panel" aria-labelledby="lead-inbox-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow electric">Momentum queue</p>
          <h3 id="lead-inbox-title">The next conversation</h3>
        </div>
        <span className="lead-queue-count">{unavailable ? "Unavailable" : `${leads.length} active`}</span>
      </div>

      {unavailable ? (
        <p className="lead-unavailable">Your queue will return when lead data is available. Refresh to try again.</p>
      ) : leads.length === 0 ? (
        <div className="empty-state">
          <h3>No active leads.</h3>
          <p>Capture a business to start the next conversation. Its first action will appear here.</p>
        </div>
      ) : (
        <div className="lead-inbox-list">
          {leads.map((lead, index) => (
            <article className="lead-inbox-row" key={lead.id}>
              <div className={`lead-queue-rank priority-${lead.priorityLabel}`} aria-label={`${lead.priorityLabel} priority, position ${index + 1}`}>
                {String(index + 1).padStart(2, "0")}
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
                <strong>{lead.score ?? "—"}<small> / 100</small></strong>
              </div>

              <Link href={`/leads/${lead.id}`} className="lead-open-link" aria-label={`Open lead: ${lead.business_name}`}>Open lead <span aria-hidden="true">↗</span></Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
