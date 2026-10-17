import Link from "next/link";
import { notFound } from "next/navigation";
import { QuickOutcomeButtons } from "@/components/leads/QuickOutcomeButtons";
import { formatElapsed, formatPacificDateTime, getSlaState, rankLead, type FlowkeepLead } from "@/lib/flowkeep";
import { createClient } from "@/lib/supabase/server";
import { convertLeadToProject, scheduleConsultation } from "../actions";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { leadId } = await params;
  const { error: formError } = await searchParams;
  const supabase = await createClient();

  const [{ data: rawLead }, { data: activities }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, created_at, updated_at")
      .eq("id", leadId)
      .maybeSingle(),
    supabase
      .from("activities")
      .select("id, event_type, summary, metadata, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!rawLead) notFound();
  const lead = rawLead as FlowkeepLead;
  const ranked = rankLead(lead);
  const sla = getSlaState(lead);
  const momentumElapsed = formatElapsed(new Date(lead.last_activity_at ?? lead.updated_at));
  const websiteHref = lead.website && /^https?:\/\//i.test(lead.website) ? lead.website : null;

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline">
        <Link href="/leads" className="text-button">← Lead Intelligence</Link>
      </div>

      <header className="page-header lead-detail-header">
        <div>
          <p className="eyebrow electric">{lead.acquisition_type} lead</p>
          <h2>{lead.business_name}</h2>
          <p className="page-description">
            {lead.contact_name || "No contact name yet"} · {lead.momentum_state}
          </p>
        </div>
        <div className="lead-score-card">
          <span>Opportunity score</span>
          <strong>{lead.score ?? "—"}</strong>
        </div>
        <form action={convertLeadToProject} className="delivery-add-form" style={{ marginTop: 10 }}>
          <input type="hidden" name="lead_id" value={lead.id} />
          <input type="text" name="project_name" placeholder="Project name (optional)…" maxLength={160} />
          <PortalSubmitButton pendingLabel="Converting…">Convert to project</PortalSubmitButton>
        </form>
      </header>

      {formError ? <div className="lead-form-error detail-error">{formError}</div> : null}

      <section className="lead-clock-grid">
        <article className="panel clock-card">
          <span>Next action</span>
          <strong>{ranked?.actionTitle ?? "No action"}</strong>
          <small>{ranked?.actionMeta ?? "Lead is closed"}</small>
        </article>
        <article className={`panel clock-card sla-${sla.status}`}>
          <span>Inbound SLA</span>
          <strong>{sla.applicable ? sla.label : "Not applicable"}</strong>
          <small>{sla.dueAt ? formatPacificDateTime(new Date(sla.dueAt)) : "Outbound lead"}</small>
        </article>
        <article className="panel clock-card">
          <span>Real momentum</span>
          <strong>{momentumElapsed}</strong>
          <small>Since the last logged activity</small>
        </article>
      </section>

      <section className="lead-detail-grid">
        <article className="panel detail-panel lead-contact-panel">
          <div className="panel-heading compact-heading">
            <div>
              <p className="eyebrow">Contact</p>
              <h3>Lead details</h3>
            </div>
          </div>
          <dl className="lead-detail-list">
            <div><dt>Email</dt><dd>{lead.email ?? "Not found yet"}</dd></div>
            <div><dt>Phone</dt><dd>{lead.phone ?? "Not found yet"}</dd></div>
            <div><dt>Website</dt><dd>{websiteHref ? <a href={websiteHref} target="_blank" rel="noreferrer">Open site ↗</a> : lead.website ? "Invalid URL" : "Not added"}</dd></div>
            <div><dt>Status</dt><dd>{lead.status}</dd></div>
            <div><dt>Last outcome</dt><dd>{lead.last_outcome ?? "None yet"}</dd></div>
          </dl>
        </article>

        <article className="panel detail-panel quick-log-panel">
          <div className="panel-heading compact-heading">
            <div>
              <p className="eyebrow electric">Quick log</p>
              <h3>What just happened?</h3>
            </div>
          </div>
          <div className="detail-panel-body">
            <QuickOutcomeButtons leadId={lead.id} />
            <p className="micro-copy">Received Reply jumps to priority one immediately. No committee meeting required.</p>
          </div>
        </article>

        <article className="panel detail-panel consultation-panel">
          <div className="panel-heading compact-heading">
            <div>
              <p className="eyebrow">Consultation</p>
              <h3>Schedule prep</h3>
            </div>
          </div>
          <form action={scheduleConsultation} className="consultation-form">
            <input type="hidden" name="lead_id" value={lead.id} />
            <label className="field">
              <span>Pacific time</span>
              <input name="consultation_at" type="datetime-local" required />
            </label>
            <PortalSubmitButton className="secondary-button wide" pendingLabel="Scheduling…">Schedule consultation</PortalSubmitButton>
          </form>
          {lead.consultation_at ? <p className="micro-copy">Current: {formatPacificDateTime(new Date(lead.consultation_at))}</p> : null}
        </article>
      </section>

      <section className="panel lead-activity-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">History</p>
            <h3>Momentum timeline</h3>
          </div>
        </div>
        <div className="lead-timeline">
          {(activities ?? []).length ? (activities ?? []).map((item) => (
            <div className="timeline-row" key={item.id}>
              <span className="activity-dot" />
              <div>
                <strong>{item.summary}</strong>
                <small>{item.event_type}</small>
              </div>
              <time>{formatPacificDateTime(new Date(item.created_at))}</time>
            </div>
          )) : <p className="muted-copy timeline-empty">No activity logged yet.</p>}
        </div>
      </section>
    </div>
  );
}
