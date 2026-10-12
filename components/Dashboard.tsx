import Link from "next/link";
import { rankLeads, type FlowkeepLead } from "@/lib/flowkeep";
import { createClient } from "@/lib/supabase/server";
import { activity, opportunities, projects } from "@/lib/mock-data";
import { MetricCard } from "./MetricCard";
import { PageHeader } from "./PageHeader";

export async function Dashboard() {
  const supabase = await createClient();
  const [{ data: rawLeads }, { count: projectCount }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, created_at, updated_at")
      .neq("status", "not_interested"),
    supabase.from("projects").select("id", { count: "exact", head: true }),
  ]);

  const rankedLeads = rankLeads((rawLeads ?? []) as FlowkeepLead[]);
  const nextActions = rankedLeads.slice(0, 3);
  const waitingOnMe = rankedLeads.filter((lead) => lead.momentum_state === "Waiting on Me" || lead.momentum_state === "New Inbound").length;
  const replies = rankedLeads.filter((lead) => lead.next_action_kind === "reply").length;
  const inboundRisk = rankedLeads.filter((lead) => lead.sla.status === "overdue" || lead.sla.status === "due_soon").length;

  const metrics = [
    { label: "Active Leads", value: String(rankedLeads.length), detail: `${replies} human repl${replies === 1 ? "y" : "ies"}`, tone: "violet" as const },
    { label: "Waiting on Me", value: String(waitingOnMe), detail: `${inboundRisk} inbound SLA risk`, tone: "pink" as const },
    { label: "Open Projects", value: String(projectCount ?? 0), detail: "Live Supabase count", tone: "cyan" as const },
    { label: "Priority Engine", value: String(nextActions.length), detail: "Top actions surfaced", tone: "green" as const },
  ];

  return (
    <div className="content-wrap">
      <PageHeader
        eyebrow="Command Center"
        title="Good evening, Hailey."
        description="The studio pulse at a glance. Human replies outrank busywork, because apparently software needed to be taught manners."
        action="+ Quick capture"
        actionHref="/leads#quick-capture"
      />

      <section className="metric-grid" aria-label="Studio metrics">
        {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>

      <section className="dashboard-grid">
        <div className="panel action-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Priority engine</p>
              <h3>Next 3 actions</h3>
            </div>
            <span className="live-pill"><i /> Live logic</span>
          </div>

          <div className="action-list">
            {nextActions.length ? nextActions.map((item, index) => (
              <article className="action-row" key={item.id}>
                <div className={`priority-number priority-${item.priorityLabel}`}>{index + 1}</div>
                <div className="action-copy">
                  <span className="action-title">{item.actionTitle}</span>
                  <strong>{item.business_name}</strong>
                  <small>{item.actionMeta}</small>
                </div>
                <Link className="ghost-button" href={`/leads/${item.id}`}>Open lead</Link>
              </article>
            )) : (
              <div className="empty-dashboard-actions">
                <strong>No lead actions yet.</strong>
                <span>Capture a lead and Flowkeep will rank the next move.</span>
              </div>
            )}
          </div>
        </div>

        <aside className="panel muse-panel">
          <div className="muse-hero">
            <span className="muse-orb large" />
            <div>
              <p className="eyebrow electric">Muse</p>
              <h3>Studio intelligence</h3>
            </div>
          </div>
          <p className="muse-copy">
            {nextActions[0]
              ? `${nextActions[0].business_name} is the strongest next move: ${nextActions[0].actionTitle.toLowerCase()}.`
              : "No urgent lead momentum yet. Suspiciously peaceful."}
          </p>
          <div className="muse-suggestion">
            <span>Suggested focus</span>
            <strong>{nextActions[0]?.actionTitle ?? "Capture the next lead"}</strong>
            <small>{nextActions[0]?.business_name ?? "Flowkeep is ready when the humans are."}</small>
          </div>
          <Link className="secondary-button wide muse-link" href="/leads">Open Lead Intelligence</Link>
        </aside>

        <div className="panel project-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Delivery</p>
              <h3>Project pulse</h3>
            </div>
            <Link className="text-button" href="/projects">View pipeline →</Link>
          </div>
          <div className="project-list">
            {projects.map((project) => (
              <div className="project-row" key={project.name}>
                <div className="project-copy">
                  <strong>{project.name}</strong>
                  <span>{project.stage} · {project.due}</span>
                </div>
                <div className="progress-track" aria-label={`${project.progress}% complete`}>
                  <span style={{ width: `${project.progress}%` }} />
                </div>
                <b>{project.progress}%</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel radar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Opportunity Radar</p>
              <h3>Best matches</h3>
            </div>
            <span className="beta-pill">Preview</span>
          </div>
          <div className="radar-list">
            {opportunities.map((item) => (
              <div className="radar-row" key={item.title}>
                <div>
                  <small>{item.source}</small>
                  <strong>{item.title}</strong>
                </div>
                <div className="score-ring"><span>{item.score}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">System</p>
              <h3>Recent activity</h3>
            </div>
          </div>
          <div className="activity-list">
            {activity.map((item) => (
              <div className="activity-row" key={`${item.time}-${item.text}`}>
                <span className="activity-dot" />
                <p>{item.text}</p>
                <time>{item.time}</time>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
