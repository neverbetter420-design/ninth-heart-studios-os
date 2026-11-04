import Link from "next/link";
import { AtelierSymbol, type AtelierSymbolName } from "./AtelierSymbol";
import { rankLeads, type FlowkeepLead } from "@/lib/flowkeep";
import { displayProgress, formatProjectDate, projectDueState } from "@/lib/project-display";
import { findStaleLeads, recommendNextAction } from "@/lib/muse";
import { createClient } from "@/lib/supabase/server";
import { LivingStudioHub } from "./LivingStudioHub";
import { NocturneStudioArt } from "./NocturneStudioArt";
import { PriorityHalo, type HaloAction } from "./PriorityHalo";

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

export async function Dashboard() {
  const supabase = await createClient();
  const [{ data: rawLeads, error: leadsError }, { count: projectCount, error: projectCountError }, { data: rawProjects, error: projectsError }, { data: rawOpportunities, error: opportunitiesError }, { data: rawActivities, error: activitiesError }] =
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

  // A failed read is not an empty studio. Keep the existing queries, but
  // distinguish unavailable data from genuine zero/empty results.
  const leadsUnavailable = Boolean(leadsError) || rawLeads === null;
  const projectsUnavailable = Boolean(projectsError) || rawProjects === null;
  const opportunitiesUnavailable = Boolean(opportunitiesError) || rawOpportunities === null;
  const activitiesUnavailable = Boolean(activitiesError) || rawActivities === null;
  const rankedLeads = rankLeads((rawLeads ?? []) as FlowkeepLead[]);
  const nextActions = rankedLeads.slice(0, 3);
  const recommendation = recommendNextAction({
    topLead: nextActions[0],
    staleCount: findStaleLeads(rankedLeads).length,
  });
  const waitingOnMe = rankedLeads.filter((lead) => lead.momentum_state === "Waiting on Me" || lead.momentum_state === "New Inbound").length;
  const repliesNeeded = rankedLeads.filter((lead) => lead.next_action_kind === "reply").length;
  const inboundRisk = rankedLeads.filter((lead) => lead.sla.status === "overdue" || lead.sla.status === "due_soon").length;

  const metrics = [
    { label: "Active Leads", value: leadsUnavailable ? "—" : String(rankedLeads.length), detail: leadsUnavailable ? "Data unavailable" : `${repliesNeeded} ${repliesNeeded === 1 ? "reply" : "replies"} needed`, tone: "violet" as const },
    { label: "Waiting on Me", value: leadsUnavailable ? "—" : String(waitingOnMe), detail: leadsUnavailable ? "Data unavailable" : `${inboundRisk} inbound SLA risk`, tone: "pink" as const },
    { label: "Total Projects", value: projectCountError || projectCount === null ? "—" : String(projectCount), detail: projectCountError || projectCount === null ? "Data unavailable" : "Across your studio", tone: "cyan" as const },
  ];

  const passages: readonly { href: string; label: string; symbol: AtelierSymbolName; tone: string }[] = [
    { href: "/leads", label: "Leads", symbol: "rose", tone: "rose" },
    { href: "/projects", label: "Projects", symbol: "key", tone: "cobalt" },
    { href: "/clients", label: "Clients", symbol: "skull", tone: "silver" },
    { href: "/opportunities", label: "Opportunities", symbol: "spark", tone: "violet" },
  ];

  const projects = (rawProjects ?? []) as { id: string; name: string; status: string; progress: number; due_date: string | null }[];
  const opportunities = (rawOpportunities ?? []) as { id: string; source: string; title: string; score: number | null }[];
  const activities = (rawActivities ?? []) as { id: string; summary: string; created_at: string }[];

  return (
    <div className="content-wrap nocturne-command-center velvet-atelier-pilot">
      <header className="nocturne-overview">
        <div className="nocturne-welcome-copy">
          <p className="eyebrow">Command Center <span aria-hidden="true">/</span> Ninth Heart Studios</p>
          <h2>Your studio, <em>in focus.</em></h2>
          <p className="page-description">A little clarity. A little momentum.<br />Space for your next beautiful thing.</p>
          <Link className="nocturne-capture" href="/leads#quick-capture">Capture a lead <span aria-hidden="true">↗</span></Link>
        </div>
        <NocturneStudioArt />
        <div className="velvet-hero-amulets" aria-hidden="true">
          <span><AtelierSymbol name="skull" size={18} /></span>
          <span><AtelierSymbol name="rose" size={18} /></span>
          <span><AtelierSymbol name="key" size={18} /></span>
        </div>
      </header>

      <div className="nhs-command-surface">
      <LivingStudioHub passages={passages} metrics={metrics} projects={projects} projectsUnavailable={projectsUnavailable} />

      <section className="dashboard-grid" aria-label="Studio priorities and projects">
        <section className="panel action-panel" aria-labelledby="nocturne-actions-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">01 · Your attention</p>
              <h3 id="nocturne-actions-title">Next 3 actions</h3>
            </div>
            <span className="live-pill"><i /> {leadsUnavailable ? "Unavailable" : "Ranked for you"}</span>
          </div>

          <div className="action-list">
            {!leadsUnavailable && nextActions.length ? (
              <PriorityHalo
                actions={nextActions.map((item): HaloAction => ({
                  id: item.id,
                  title: item.actionTitle,
                  businessName: item.business_name,
                  meta: item.actionMeta,
                  priority: item.priorityLabel,
                }))}
              />
            ) : (
              <div className="empty-dashboard-actions velvet-open-empty">
                <div className="velvet-priority-orbit" aria-hidden="true">
                  <span className="velvet-orbit-line velvet-orbit-line--outer" />
                  <span className="velvet-orbit-line velvet-orbit-line--inner" />
                  <span className="velvet-orbit-center"><AtelierSymbol name="skull" size={36} /></span>
                  <span className="velvet-orbit-point velvet-orbit-point--rose"><AtelierSymbol name="rose" size={20} /></span>
                  <span className="velvet-orbit-point velvet-orbit-point--key"><AtelierSymbol name="key" size={19} /></span>
                  <span className="velvet-orbit-point velvet-orbit-point--spark"><AtelierSymbol name="spark" size={18} /></span>
                </div>
                <div className="velvet-open-empty__copy">
                  <span className="velvet-open-empty__kicker">{leadsUnavailable ? "Signal interrupted" : "A quiet studio, for now"}</span>
                  <strong>{leadsUnavailable ? "Lead data unavailable." : "No lead actions yet."}</strong>
                  <span role={leadsUnavailable ? "status" : undefined}>{leadsUnavailable ? "Priorities could not load. Refresh to retry." : "Your next move starts with a conversation. Capture a lead to bring it into focus."}</span>
                  <Link href={leadsUnavailable ? "/leads" : "/leads#quick-capture"} className="nocturne-empty-link">{leadsUnavailable ? "Open Leads" : "Capture a lead"} <span aria-hidden="true">↗</span></Link>
                </div>
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
            {projectsUnavailable ? (
              <div className="velvet-project-empty" role="status">
                <span aria-hidden="true"><AtelierSymbol name="key" size={19} /></span>
                <p className="pipeline-empty">Project data unavailable. Refresh to retry.</p>
              </div>
            ) : projects.length ? projects.map((project, index) => {
              const progress = displayProgress(project.progress);
              const due = project.status === "on_hold" ? null : projectDueState(project.due_date);
              return (
                <article className="project-row velvet-project-journey" key={project.id}>
                  <span className="velvet-project-journey__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div className="velvet-project-journey__content">
                    <div className="project-copy">
                      <strong>
                        <Link href={"/projects/" + project.id}>
                          {project.name}<span className="velvet-project-journey__link-mark" aria-hidden="true">↗</span>
                        </Link>
                      </strong>
                      <span className="velvet-project-journey__meta">
                        <span className="velvet-project-journey__phase">{stageLabel(project.status)}</span>
                        <span aria-hidden="true">·</span>
                        <span className={"velvet-project-journey__due" + (due ? " velvet-project-journey__due--" + due : "")}>
                          {due === "overdue" ? "Overdue · " : due === "soon" ? "Due soon · " : ""}{formatProjectDate(project.due_date)}
                        </span>
                      </span>
                    </div>
                    <div className="velvet-project-journey__measure">
                      <div className="progress-track" role="progressbar" aria-label={"Recorded progress for " + project.name} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                        <span style={{ width: progress + "%" }} />
                      </div>
                      <b>{progress}%</b>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <div className="velvet-project-empty">
                <span aria-hidden="true"><AtelierSymbol name="key" size={19} /></span>
                <p className="pipeline-empty">No projects yet. Create one from a lead or from the pipeline.</p>
              </div>
            )}
          </div>
        </section>

      </section>

      <section className="nocturne-activity" aria-labelledby="nocturne-activity-title">
        <div className="nocturne-activity-heading">
          <p className="eyebrow">03 · The latest</p>
          <h3 id="nocturne-activity-title">Around the studio</h3>
        </div>
        <div className="activity-list velvet-activity-timeline" role="list" aria-label="Recent studio activity">
          {activitiesUnavailable ? (
            <div className="velvet-chronicle-state velvet-chronicle-state--unavailable">
              <span className="velvet-chronicle-state__mark" aria-hidden="true"><AtelierSymbol name="spark" size={27} /></span>
              <div className="velvet-chronicle-state__copy">
                <strong>Studio signal interrupted.</strong>
                <p className="nocturne-activity-empty" role="status">Studio activity unavailable. Refresh to retry.</p>
              </div>
            </div>
          ) : activities.length ? activities.map((item) => (
            <article className="activity-row velvet-activity-event" role="listitem" key={item.id}>
              <span className="activity-dot" aria-hidden="true" />
              <p>{item.summary}</p>
              <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
            </article>
          )) : (
            <div className="velvet-chronicle-state velvet-chronicle-state--quiet">
              <span className="velvet-chronicle-state__mark" aria-hidden="true"><AtelierSymbol name="rose" size={27} /></span>
              <div className="velvet-chronicle-state__copy">
                <strong>A little room for what comes next.</strong>
                <p className="nocturne-activity-empty">A quiet moment. Your studio activity will appear here.</p>
              </div>
            </div>
          )}
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
          {leadsUnavailable ? (
            <p className="muse-copy" role="status">Lead recommendations are unavailable. Refresh to retry.</p>
          ) : (
            <>
              <p className="muse-copy">{recommendation.detail}</p>
              <div className="muse-suggestion">
                <span>The one thing</span>
                <strong>{recommendation.title}</strong>
                <small>{recommendation.why}</small>
              </div>
            </>
          )}
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
            {opportunitiesUnavailable ? (
              <p className="pipeline-empty" role="status">Opportunity data unavailable. Refresh to retry.</p>
            ) : opportunities.length ? opportunities.map((item) => (
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
