import Link from "next/link";
import { rankLeads, type FlowkeepLead } from "@/lib/flowkeep";
import { findStaleLeads, recommendNextAction } from "@/lib/muse";
import { createClient } from "@/lib/supabase/server";
import { MetricCard } from "./MetricCard";
import { NocturneStudioArt } from "./NocturneStudioArt";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stageLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function dueLabel(dueDate: string | null): string {
  if (!dueDate) return "Ongoing";
  return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function Dashboard() {
  const supabase = await createClient();
  const [{ data: rawLeads }, { count: projectCount }, { data: rawProjects }, { data: rawOpportunities }, { data: rawActivities }] =
    await Promise.all([
      supabase
        .from("leads")
        .select("id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, created_at, updated_at")
        .neq("status", "not_interested"),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase
        .from("projects")
        .select("id, name, status, progress, due_date, updated_at")
        .order("updated_at", { ascending: false })
        .limit(4),
      supabase
        .from("opportunities")
        .select("id, source, title, score")
        .not("status", "in", "(won,lost,passed)")
        .order("score", { ascending: false, nullsFirst: false })
        .limit(3),
      supabase
        .from("activities")
        .select("id, summary, created_at")
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

  const rankedLeads = rankLeads((rawLeads ?? []) as FlowkeepLead[]);
  const nextActions = rankedLeads.slice(0, 3);
  const recommendation = recommendNextAction({
    topLead: nextActions[0],
    staleCount: findStaleLeads(rankedLeads).length,
  });
  const waitingOnMe = rankedLeads.filter((lead) => lead.momentum_state === "Waiting on Me" || lead.momentum_state === "New Inbound").length;
  const replies = rankedLeads.filter((lead) => lead.next_action_kind === "reply").length;
  const inboundRisk = rankedLeads.filter((lead) => lead.sla.status === "overdue" || lead.sla.status === "due_soon").length;

  const metrics = [
    { label: "Active Leads", value: String(rankedLeads.length), detail: `${replies} human repl${replies === 1 ? "y" : "ies"}`, tone: "violet" as const },
    { label: "Waiting on Me", value: String(waitingOnMe), detail: `${inboundRisk} inbound SLA risk`, tone: "pink" as const },
    { label: "Open Projects", value: String(projectCount ?? 0), detail: "Across your studio", tone: "cyan" as const },
  ];

  const projects = (rawProjects ?? []) as { id: string; name: string; status: string; progress: number; due_date: string | null }[];
  const opportunities = (rawOpportunities ?? []) as { id: string; source: string; title: string; score: number | null }[];
  const activities = (rawActivities ?? []) as { id: string; summary: string; created_at: string }[];

  return (
    <div className="content-wrap nocturne-command-center">
      <header className="nocturne-overview">
        <div className="nocturne-welcome-copy">
          <p className="eyebrow">Command Center <span aria-hidden="true">/</span> Ninth Heart Studios</p>
          <h2>Your studio, <em>in focus.</em></h2>
          <p className="page-description">A little clarity. A little momentum.<br />Space for your next beautiful thing.</p>
          <Link className="nocturne-capture" href="/leads#quick-capture">Capture a lead <span aria-hidden="true">↗</span></Link>
        </div>
        <NocturneStudioArt />
      </header>

      <div className="nhs-command-surface">
      <section className="metric-grid" aria-label="Studio metrics">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <section className="dashboard-grid" aria-label="Studio priorities and projects">
        <section className="panel action-panel" aria-labelledby="nocturne-actions-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">01 · Your attention</p>
              <h3 id="nocturne-actions-title">Next 3 actions</h3>
            </div>
            <span className="live-pill"><i /> Ranked for you</span>
          </div>

          <div className="action-list">
            {nextActions.length ? nextActions.map((item, index) => (
              <article className="action-row" key={item.id}>
                <div className={`priority-number priority-${item.priorityLabel}`} aria-hidden="true">0{index + 1}</div>
                <div className="action-copy">
                  <span className="action-title">{item.actionTitle}</span>
                  <strong>{item.business_name}</strong>
                  <small>{item.actionMeta}</small>
                </div>
                <Link className="ghost-button" href={`/leads/${item.id}`} aria-label={`Open lead: ${item.business_name}`}>Open lead <span aria-hidden="true">↗</span></Link>
              </article>
            )) : (
              <div className="empty-dashboard-actions">
                <strong>No lead actions yet.</strong>
                <span>Your next move starts with a conversation. Capture a lead to bring it into focus.</span>
                <Link href="/leads#quick-capture" className="nocturne-empty-link">Capture a lead <span aria-hidden="true">↗</span></Link>
              </div>
            )}
          </div>
        </section>

        <section className="panel project-panel" aria-labelledby="nocturne-projects-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">02 · In motion</p>
              <h3 id="nocturne-projects-title">Project pulse</h3>
            </div>
            <Link className="text-button" href="/projects">View pipeline →</Link>
          </div>
          <div className="project-list">
            {projects.length ? projects.map((project) => (
              <div className="project-row" key={project.id}>
                <div className="project-copy">
                  <strong><Link href={"/projects/" + project.id}>{project.name}</Link></strong>
                  <span>{stageLabel(project.status)} · {dueLabel(project.due_date)}</span>
                </div>
                <div className="progress-track" aria-label={`${project.progress}% complete`}>
                  <span style={{ width: `${project.progress}%` }} />
                </div>
                <b>{project.progress}%</b>
              </div>
            )) : (
              <p className="pipeline-empty">No projects yet. Create one from a lead or from the pipeline.</p>
            )}
          </div>
        </section>

      </section>

      <section className="nocturne-activity" aria-labelledby="nocturne-activity-title">
        <div className="nocturne-activity-heading">
          <p className="eyebrow">03 · The latest</p>
          <h3 id="nocturne-activity-title">Around the studio</h3>
        </div>
        <div className="activity-list">
          {activities.length ? activities.map((item) => (
            <div className="activity-row" key={item.id}>
              <span className="activity-dot" aria-hidden="true" />
              <p>{item.summary}</p>
              <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
            </div>
          )) : <p className="nocturne-activity-empty">A quiet moment. Your studio activity will appear here.</p>}
        </div>
      </section>

      <details className="nocturne-insights">
        <summary>
          <span><strong>A little more perspective.</strong><small>Muse recommendations & opportunity radar</small></span>
          <span className="nocturne-insights-toggle" aria-hidden="true">Explore</span>
        </summary>
        <div className="nocturne-insights-grid">
        <aside className="panel muse-panel">
          <div className="muse-hero">
            <span className="muse-orb large" />
            <div>
              <p className="eyebrow electric">Muse</p>
              <h3>Studio intelligence</h3>
            </div>
          </div>
          <p className="muse-copy">{recommendation.detail}</p>
          <div className="muse-suggestion">
            <span>The one thing</span>
            <strong>{recommendation.title}</strong>
            <small>{recommendation.why}</small>
          </div>
          <Link className="secondary-button wide muse-link" href="/muse">
            Open Muse
          </Link>
        </aside>

        <div className="panel radar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Opportunity Radar</p>
              <h3>Best matches</h3>
            </div>
            <span className="beta-pill">Preview</span>
          </div>
          <div className="radar-list">
            {opportunities.length ? opportunities.map((item) => (
              <div className="radar-row" key={item.id}>
                <div>
                  <small>{item.source}</small>
                  <strong><Link href={"/opportunities/" + item.id}>{item.title}</Link></strong>
                </div>
                <div className="score-ring"><span>{item.score ?? "—"}</span></div>
              </div>
            )) : (
              <p className="pipeline-empty">No open opportunities. Add one from the Radar.</p>
            )}
          </div>
        </div>

        </div>
      </details>
      </div>
    </div>
  );
}
