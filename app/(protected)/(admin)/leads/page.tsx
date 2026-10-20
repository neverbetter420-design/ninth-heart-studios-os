import { LeadCaptureCard } from "@/components/leads/LeadCaptureCard";
import { LeadInbox } from "@/components/leads/LeadInbox";
import { MetricCard } from "@/components/MetricCard";
import { rankLeads, type FlowkeepLead } from "@/lib/flowkeep";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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
    <div className="content-wrap nocturne-leads">
      <header className="page-header lead-editorial-heading">
        <div>
          <p className="eyebrow electric">Lead Intelligence</p>
          <h2>Every connection,<br /><em>a next step.</em></h2>
          <p className="page-description">
            Keep the conversation moving. Your queue brings replies and time-sensitive follow-ups into focus.
          </p>
        </div>
        <div className="header-actions">
          <Link className="lead-scanner-link" href="/leads/discover">Lead Scanner <span aria-hidden="true">↗</span></Link>
          <a className="primary-button lead-capture-jump" href="#quick-capture">+ Quick capture</a>
        </div>
      </header>

      <section className="metric-grid" aria-label="Lead metrics">
        <MetricCard label="Active Leads" value={error ? "—" : String(leads.length)} detail="Ranked by momentum" tone="violet" />
        <MetricCard label="Waiting on Me" value={error ? "—" : String(waitingOnMe)} detail="Human attention required" tone="pink" />
        <MetricCard label="Replies" value={error ? "—" : String(replies)} detail="Always priority one" tone="cyan" />
        <MetricCard label="Inbound SLA Risk" value={error ? "—" : String(inboundAtRisk)} detail="Due soon or overdue" tone="green" />
      </section>

      {error ? (
        <section className="lead-query-error" role="alert">
          <strong>Lead data could not load.</strong>
          <span>{error.message}</span>
        </section>
      ) : null}

      <div className="lead-page-grid">
        <LeadInbox leads={leads} unavailable={Boolean(error)} />
        <LeadCaptureCard error={formError} />
      </div>
    </div>
  );
}
