import Link from "next/link";
import { notFound } from "next/navigation";
import { QuickOutcomeButtons } from "@/components/leads/QuickOutcomeButtons";
import { formatElapsed, formatPacificDateTime, getSlaState, rankLead, type FlowkeepLead } from "@/lib/flowkeep";
import { createClient } from "@/lib/supabase/server";
import { auditLeadWebsite, convertLeadToProject, scheduleConsultation } from "../actions";
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
      .select("id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, metadata, created_at, updated_at")
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
  const leadMetadata = ((rawLead as { metadata?: unknown }).metadata ?? {}) as {
    website_audit?: {
      status?: string; website?: string; checked_at?: string;
      score?: number | null;
      signals?: { reachable?: boolean; https?: boolean; mobile_viewport?: boolean; builder?: string | null };
    };
  };
  const websiteAudit = leadMetadata.website_audit;


  return (
    <div className="content-wrap nocturne-leads nocturne-lead-workspace">
      <div className="lead-detail-backline">
        <Link href="/leads" className="text-button">← Lead Intelligence</Link>
      </div>

      <header className="page-header lead-editorial-heading lead-detail-header">
        <div>
          <p className="eyebrow electric">{lead.acquisition_type} lead</p>
          <h2>{lead.business_name}</h2>
          <p className="page-description">{lead.contact_name || "No contact name yet"} · {lead.momentum_state}</p>
        </div>
        <div className="lead-score-card">
          <span>Opportunity score</span>
          <strong>{lead.score ?? "—"}<small> / 100</small></strong>
        </div>
      </header>

      {formError ? <div className="lead-form-error detail-error" role="alert">{formError}</div> : null}

      <section className="lead-clock-grid" aria-label="Lead momentum">
        <article className="clock-card">
          <span>Next action</span>
          <strong>{ranked?.actionTitle ?? "No action"}</strong>
          <small>{ranked?.actionMeta ?? "Lead is closed"}</small>
        </article>
        <article className={`clock-card sla-${sla.status}`}>
          <span>Inbound SLA</span>
          <strong>{sla.applicable ? sla.label : "Not applicable"}</strong>
          <small>{sla.dueAt ? formatPacificDateTime(new Date(sla.dueAt)) : "Outbound lead"}</small>
        </article>
        <article className="clock-card">
          <span>Time since activity</span>
          <strong>{momentumElapsed}</strong>
          <small>Since the last logged activity</small>
        </article>
      </section>

      <div className="lead-detail-grid">
        <div className="lead-conversation-column">
          <section className="quick-log-panel" aria-labelledby="lead-quick-log-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow electric">Keep it moving</p>
                <h3 id="lead-quick-log-title">Log the conversation</h3>
              </div>
            </div>
            <QuickOutcomeButtons leadId={lead.id} />
            <p className="micro-copy">Received Reply moves this lead to the top of your queue.</p>
          </section>

          <section className="lead-activity-panel" aria-labelledby="lead-history-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">The conversation so far</p>
                <h3 id="lead-history-title">Momentum timeline</h3>
              </div>
            </div>
            <div className="lead-timeline">
              {(activities ?? []).length ? (activities ?? []).map((item) => (
                <div className="timeline-row" key={item.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{item.summary}</strong>
                    <small>{item.event_type.replaceAll("_", " ")}</small>
                  </div>
                  <time dateTime={item.created_at}>{formatPacificDateTime(new Date(item.created_at))}</time>
                </div>
              )) : <p className="muted-copy timeline-empty">No activity logged yet. Log a conversation to begin the timeline.</p>}
            </div>
          </section>
        </div>

        <aside className="lead-context-column" aria-label="Lead details and planning">
          <section className="lead-contact-panel" aria-labelledby="lead-contact-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">The connection</p>
                <h3 id="lead-contact-title">Lead details</h3>
              </div>
            </div>
            <dl className="lead-detail-list">
              <div><dt>Email</dt><dd>{lead.email ?? "Not found yet"}</dd></div>
              <div><dt>Phone</dt><dd>{lead.phone ?? "Not found yet"}</dd></div>
              <div><dt>Website</dt><dd>{websiteHref ? <a href={websiteHref} target="_blank" rel="noreferrer">Open site ↗</a> : lead.website ? "Invalid URL" : "Not added"}</dd></div>
              <div><dt>Status</dt><dd>{lead.status}</dd></div>
              <div><dt>Last outcome</dt><dd>{lead.last_outcome ?? "None yet"}</dd></div>
            </dl>
          </section>

          <section className="lead-contact-panel" aria-labelledby="lead-audit-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">A closer look</p>
                <h3 id="lead-audit-title">Website audit</h3>
              </div>
            </div>
            <p className="micro-copy">
              {websiteAudit?.status === "queued" ? "Audit queued after Lead Finder import. Run it when you are ready." :
                websiteAudit?.status === "running" ? "Website audit is running." :
                websiteAudit?.status === "complete" ? "Most recent website audit completed." :
                websiteAudit?.status === "inconclusive" ? "The website could not be verified. No redesign conclusions were drawn." :
                "No website audit recorded for this lead."}
            </p>
            {websiteAudit?.checked_at ? (
              <p className="micro-copy">Checked {formatPacificDateTime(new Date(websiteAudit.checked_at))}</p>
            ) : null}
            {websiteAudit?.status === "complete" && websiteAudit.signals ? (
              <dl className="lead-detail-list">
                <div><dt>Opportunity score</dt><dd>{websiteAudit.score ?? "—"} / 100</dd></div>
                <div><dt>HTTPS</dt><dd>{websiteAudit.signals.https ? "Yes" : "Review"}</dd></div>
                <div><dt>Mobile viewport</dt><dd>{websiteAudit.signals.mobile_viewport ? "Detected" : "Not detected"}</dd></div>
                <div><dt>Site builder</dt><dd>{websiteAudit.signals.builder ?? "Not identified"}</dd></div>
              </dl>
            ) : null}
            {websiteHref ? (
              <form action={auditLeadWebsite}>
                <input type="hidden" name="lead_id" value={lead.id} />
                <PortalSubmitButton className="secondary-button wide" pendingLabel="Auditing website…">
                  {websiteAudit?.status === "complete" ? "Re-run website audit" : "Run website audit"}
                </PortalSubmitButton>
              </form>
            ) : <p className="micro-copy">Add a verified website before running an audit.</p>}
            <p className="micro-copy">Audits are on-demand. No outreach is sent automatically.</p>
          </section>

          <section className="consultation-panel" aria-labelledby="lead-consultation-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Make time</p>
                <h3 id="lead-consultation-title">Consultation</h3>
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
          </section>

          <details className="lead-conversion">
            <summary><span>Ready for a project?</span><span aria-hidden="true">+</span></summary>
            <p>Create a client and a project in Discovery, or use the client already linked to this lead.</p>
            <form action={convertLeadToProject} className="lead-conversion-form">
              <input type="hidden" name="lead_id" value={lead.id} />
              <label className="field">
                <span>Project name (optional)</span>
                <input type="text" name="project_name" placeholder="Project name" maxLength={160} />
              </label>
              <PortalSubmitButton className="primary-button" pendingLabel="Converting…">Convert to project</PortalSubmitButton>
            </form>
          </details>
        </aside>
      </div>
    </div>
  );
}
