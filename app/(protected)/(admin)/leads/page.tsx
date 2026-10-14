import { LeadCaptureCard } from "@/components/leads/LeadCaptureCard";
import { LeadInbox } from "@/components/leads/LeadInbox";
import { MetricCard } from "@/components/MetricCard";
import { rankLeads, type FlowkeepLead } from "@/lib/flowkeep";
import { createClient } from "@/lib/supabase/server";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: formError } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, created_at, updated_at")
    .neq("status", "not_interested")
    .order("updated_at", { ascending: false });

  const leads = rankLeads((data ?? []) as FlowkeepLead[]);
  const waitingOnMe = leads.filter((lead) => lead.momentum_state === "Waiting on Me" || lead.momentum_state === "New Inbound").length;
  const inboundAtRisk = leads.filter((lead) => lead.sla.status === "overdue" || lead.sla.status === "due_soon").length;
  const replies = leads.filter((lead) => lead.next_action_kind === "reply").length;

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Lead Intelligence</p>
          <h2>Momentum before clutter.</h2>
          <p className="page-description">
            Capture fast, rank the real next action, and keep human replies above outbound busywork. Revolutionary, apparently.
          </p>
        </div>
        <div className="header-actions">
          <a className="mini-button" href="/leads/discover">⌖ Lead Scanner</a>
          <a className="primary-button lead-capture-jump" href="#quick-capture">+ Quick capture</a>
        </div>
      </header>

      <section className="metric-grid" aria-label="Lead metrics">
        <MetricCard label="Active Leads" value={String(leads.length)} detail="Ranked by momentum" tone="violet" />
        <MetricCard label="Waiting on Me" value={String(waitingOnMe)} detail="Human attention required" tone="pink" />
        <MetricCard label="Replies" value={String(replies)} detail="Always priority one" tone="cyan" />
        <MetricCard label="Inbound SLA Risk" value={String(inboundAtRisk)} detail="Due soon or overdue" tone="green" />
      </section>

      {error ? (
        <section className="panel lead-query-error">
          <strong>Lead data could not load.</strong>
          <span>{error.message}</span>
        </section>
      ) : null}

      <div className="lead-page-grid">
        <LeadCaptureCard error={formError} />
        <LeadInbox leads={leads} />
      </div>
    </div>
  );
}
