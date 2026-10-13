import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rankLeads, type FlowkeepLead } from "@/lib/flowkeep";
import {
  buildDraftFromTarget,
  explainPriority,
  findStaleLeads,
  recommendNextAction,
  summarizeProjectRisk,
  type DraftTarget,
  type MuseDraftKind,
  type ProjectRisk,
  type ProjectRiskInput,
} from "@/lib/muse";
import { PageHeader } from "@/components/PageHeader";
import { CopyButton } from "@/components/CopyButton";
import { isEmailConfigured } from "@/lib/email";
import { sendDraftEmail } from "./actions";

export const dynamic = "force-dynamic";

const LEAD_SELECT =
  "id, business_name, contact_name, email, phone, website, acquisition_type, momentum_state, score, status, next_action, next_action_kind, next_action_due, original_inquiry_at, last_outreach_at, last_reply_at, last_activity_at, consultation_at, last_outcome, created_at, updated_at";

const DRAFT_KINDS: { value: MuseDraftKind; label: string }[] = [
  { value: "follow_up", label: "Follow-up email" },
  { value: "proposal", label: "Proposal" },
  { value: "check_in", label: "Client check-in" },
];

const RISK_TONE: Record<ProjectRisk["level"], string> = {
  critical: "risk-critical",
  high: "risk-high",
  watch: "risk-watch",
  low: "risk-low",
};

async function saveDraft(formData: FormData) {
  "use server";
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const clean = (v: FormDataEntryValue | null) => {
    const t = String(v ?? "").trim();
    return t || null;
  };
  const kind = String(formData.get("kind") ?? "follow_up");
  if (!["follow_up", "proposal", "check_in"].includes(kind)) return;
  const targetParam = String(formData.get("target") ?? "");
  const [targetType, targetId] = targetParam.split(":");
  await supabase.from("muse_drafts").insert({
    kind,
    subject: clean(formData.get("subject")) ?? "(no subject)",
    body: clean(formData.get("body")) ?? "",
    lead_id: targetType === "lead" ? targetId || null : null,
    opportunity_id: targetType === "opportunity" ? targetId || null : null,
    project_id: targetType === "project" ? targetId || null : null,
    status: "draft",
    created_by: user.id,
  });
  revalidatePath("/muse");
}

async function archiveDraft(formData: FormData) {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await supabase.from("muse_drafts").update({ status: "archived" }).eq("id", id);
  revalidatePath("/muse");
}

type SearchParams = { kind?: string; target?: string };

export default async function MusePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;

  const [{ data: rawLeads }, { data: rawProjects }, { data: rawOpportunities }, { data: drafts }] =
    await Promise.all([
      supabase.from("leads").select(LEAD_SELECT).neq("status", "not_interested"),
      supabase
        .from("projects")
        .select("id, name, status, due_date, updated_at, clients(name)")
        .order("updated_at", { ascending: false })
        .limit(8),
      supabase
        .from("opportunities")
        .select("id, title, source, url, score, status")
        .neq("status", "closed")
        .order("score", { ascending: false, nullsFirst: false })
        .limit(5),
      supabase
        .from("muse_drafts")
        .select("id, kind, subject, body, lead_id, opportunity_id, project_id, status, created_at")
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const ranked = rankLeads((rawLeads ?? []) as FlowkeepLead[]);
  const explanations = ranked.slice(0, 3).map((lead) => explainPriority(lead));
  const stale = findStaleLeads(ranked);
  const emailConfigured = isEmailConfigured();

  const projects = (rawProjects ?? []) as {
    id: string;
    name: string;
    status: string;
    due_date: string | null;
    updated_at: string;
    clients: { name: string | null } | { name: string | null }[] | null;
  }[];

  const clientName = (
    rel: { name: string | null } | { name: string | null }[] | null,
  ): string | null => {
    if (!rel) return null;
    const first = Array.isArray(rel) ? rel[0] : rel;
    return first?.name ?? null;
  };

  const risks: ProjectRisk[] = [];
  for (const project of projects) {
    const [{ data: milestones }, { data: tasks }, { data: approvals }] = await Promise.all([
      supabase.from("milestones").select("title, status, due_date").eq("project_id", project.id),
      supabase.from("tasks").select("title, status, due_at").eq("project_id", project.id),
      supabase.from("approvals").select("id, decided_at").eq("project_id", project.id),
    ]);
    const input: ProjectRiskInput = {
      id: project.id,
      name: project.name,
      status: project.status,
      dueDate: project.due_date,
      lastActivityAt: project.updated_at,
      milestones: (milestones ?? []).map((m) => ({
        title: String(m.title),
        status: String(m.status),
        dueDate: (m.due_date as string | null) ?? null,
      })),
      tasks: (tasks ?? []).map((t) => ({
        title: String(t.title),
        status: String(t.status),
        dueDate: (t.due_at as string | null) ?? null,
      })),
      pendingApprovals: (approvals ?? []).filter((a) => !a.decided_at).length,
    };
    risks.push(summarizeProjectRisk(input));
  }
  const activeRisks = risks.filter((r) => r.level !== "low");
  const topRisk = activeRisks[0];

  const topOpportunity = (rawOpportunities ?? [])[0] as
    | { id: string; title: string; score: number | null }
    | undefined;

  const recommendation = recommendNextAction({
    topLead: ranked[0],
    topRisk,
    topOpportunity,
    staleCount: stale.length,
  });

  // Draft composer: ?kind=follow_up&target=lead:<id>
  let preview: { subject: string; body: string; kind: MuseDraftKind; target: DraftTarget } | null = null;
  const kindParam = (params.kind ?? "") as string;
  const targetParam = (params.target ?? "") as string;
  if (DRAFT_KINDS.some((k) => k.value === kindParam) && targetParam.includes(":")) {
    const [targetType, targetId] = targetParam.split(":");
    let target: DraftTarget | null = null;
    if (targetType === "lead") {
      const lead = (rawLeads ?? []).find((l) => l.id === targetId) as FlowkeepLead | undefined;
      if (lead) target = { type: "lead", lead };
    } else if (targetType === "opportunity") {
      const opp = (rawOpportunities ?? []).find((o) => o.id === targetId) as
        | { title: string; source?: string | null; url?: string | null }
        | undefined;
      if (opp) target = { type: "opportunity", opportunity: opp };
    } else if (targetType === "project") {
      const project = projects.find((p) => p.id === targetId);
      if (project)
        target = {
          type: "project",
          project: { name: project.name, clientName: clientName(project.clients) },
        };
    }
    if (target) {
      const kind = kindParam as MuseDraftKind;
      const generated = buildDraftFromTarget(target, kind);
      preview = { subject: generated.subject, body: generated.body, kind, target };
    }
  }

  const targetOptions: { value: string; label: string }[] = [
    ...(ranked.slice(0, 10).map((l) => ({ value: `lead:${l.id}`, label: `Lead — ${l.business_name}` }))),
    ...((rawOpportunities ?? []).map((o) => ({
      value: `opportunity:${o.id}`,
      label: `Opportunity — ${o.title}`,
    }))),
    ...(projects.map((p) => ({ value: `project:${p.id}`, label: `Project — ${p.name}` }))),
  ];

  return (
    <div className="content-wrap">
      <PageHeader
        eyebrow="Muse"
        title="Studio intelligence, minus the guesswork."
        description="Why the priority engine ranks what it ranks, where delivery is at risk, who's going quiet — and drafts you can steal. Muse explains and drafts. It never sends anything anywhere."
      />

      <section className="panel muse-reco" aria-label="Top recommendation">
        <p className="eyebrow electric">The one thing</p>
        <h3>{recommendation.title}</h3>
        <p className="muse-copy">{recommendation.detail}</p>
        <p className="muse-why">
          <strong>Why:</strong> {recommendation.why}
        </p>
        <Link className="secondary-button" href={recommendation.href}>
          Go handle it →
        </Link>
      </section>

      <section className="muse-grid">
        <div className="panel" aria-label="Prioritization explanations">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Why these are next</p>
              <h3>Priority, explained</h3>
            </div>
          </div>
          {explanations.length > 0 ? (
            <div className="muse-explain-list">
              {explanations.map((exp) => (
                <article key={exp.leadId} className="muse-explain">
                  <div className="muse-explain-head">
                    <strong>{exp.businessName}</strong>
                    <span className={`priority-pill ${exp.priorityLabel}`}>{exp.priorityLabel}</span>
                  </div>
                  <p className="muse-explain-action">{exp.actionTitle}</p>
                  <ul>
                    {exp.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                  <Link className="text-button" href={`/leads/${exp.leadId}`}>
                    Open lead →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No ranked leads yet. The engine is idling.</p>
          )}
        </div>

        <div className="panel" aria-label="Project risk">
          <div className="panel-heading">
            <div>
              <p className="eyebrow electric">Delivery radar</p>
              <h3>Project risk</h3>
            </div>
            <Link className="text-button" href="/projects">
              View pipeline →
            </Link>
          </div>
          {activeRisks.length > 0 ? (
            <div className="muse-risk-list">
              {activeRisks.map((risk) => (
                <article key={risk.projectId} className={`muse-risk ${RISK_TONE[risk.level]}`}>
                  <div className="muse-explain-head">
                    <strong>{risk.name}</strong>
                    <span className={`priority-pill ${risk.level}`}>{risk.level}</span>
                  </div>
                  <ul>
                    {risk.factors.map((factor, i) => (
                      <li key={i}>{factor}</li>
                    ))}
                  </ul>
                  <Link className="text-button" href={`/projects/${risk.projectId}`}>
                    Open project →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No delivery risks flagged. Suspicious, but we'll take it.</p>
          )}
        </div>
      </section>

      <section className="panel" id="stale" aria-label="Stale leads">
        <div className="panel-heading">
          <div>
            <p className="eyebrow electric">Going quiet</p>
            <h3>Stale leads</h3>
          </div>
        </div>
        {stale.length > 0 ? (
          <div className="muse-stale-list">
            {stale.slice(0, 8).map((s) => (
              <div key={s.leadId} className="muse-stale-row">
                <div>
                  <strong>{s.businessName}</strong>
                  <span>{s.reason}</span>
                </div>
                <div className="muse-stale-actions">
                  <Link className="ghost-button" href={`/muse?kind=check_in&target=lead:${s.leadId}`}>
                    Draft check-in
                  </Link>
                  <Link className="text-button" href={`/leads/${s.leadId}`}>
                    Open →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Nobody's going quiet. The pipeline has manners today.</p>
        )}
      </section>

      <section className="panel" aria-label="Draft composer">
        <div className="panel-heading">
          <div>
            <p className="eyebrow electric">Drafts, not dispatches</p>
            <h3>Muse drafts</h3>
          </div>
        </div>
        <p className="muse-copy">
          Pick a kind and a target, and Muse writes the first version. You edit, you copy, you send it
          yourself — nothing leaves this app on its own. Ever.
        </p>
        <form className="muse-composer" method="get" action="/muse">
          <label>
            <span>Draft kind</span>
            <select name="kind" defaultValue={kindParam || "follow_up"}>
              {DRAFT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Target</span>
            <select name="target" defaultValue={targetParam}>
              <option value="">Choose…</option>
              {targetOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" type="submit">
            Generate draft
          </button>
        </form>

        {preview && (
          <form className="muse-preview" action={saveDraft}>
            <input type="hidden" name="kind" value={preview.kind} />
            <input type="hidden" name="target" value={targetParam} />
            {preview.target.type === "lead" && (
              <input type="hidden" name="lead_id" value={preview.target.lead.id} />
            )}
            <label>
              <span>Subject</span>
              <input name="subject" defaultValue={preview.subject} />
            </label>
            <label>
              <span>Body</span>
              <textarea name="body" rows={14} defaultValue={preview.body} />
            </label>
            <div className="muse-preview-actions">
              <button className="secondary-button" type="submit">
                Save draft
              </button>
              <span className="muted small">Saved as a draft. Nothing is sent.</span>
            </div>
          </form>
        )}

        {(drafts ?? []).length > 0 && (
          <div className="muse-drafts-list">
            <h4>Saved drafts</h4>
            {(drafts ?? []).map((d) => (
              <article key={d.id} className="muse-draft-row">
                <div>
                  <strong>{d.subject}</strong>
                  <span>
                    {d.kind.replace("_", " ")} ·{" "}
                    {new Date(d.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="muse-stale-actions">
                  <CopyButton text={`${d.subject}\n\n${d.body}`} />
                  {emailConfigured ? (
                    <details className="muse-send-details">
                      <summary className="mini-button go">Send via Gmail</summary>
                      <form action={sendDraftEmail} className="muse-send-form">
                        <input type="hidden" name="draft_id" value={d.id} />
                        <input
                          type="email"
                          name="to"
                          placeholder="recipient@example.com"
                          required
                          aria-label="Recipient address"
                        />
                        <button type="submit" className="mini-button go">
                          Confirm send
                        </button>
                        <p className="muted small">You approve every send. It's logged.</p>
                      </form>
                    </details>
                  ) : null}
                  <form action={archiveDraft}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="ghost-button" type="submit">
                      Archive
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
