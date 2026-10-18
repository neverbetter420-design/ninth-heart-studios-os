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
import {
  DocumentSectionHeading,
  DocumentNotice,
  documentDate,
} from "@/components/documents/DocumentChrome";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";
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
  await supabase
    .from("muse_drafts")
    .update({ status: "archived" })
    .eq("id", id);
  revalidatePath("/muse");
}

type SearchParams = { kind?: string; target?: string };

export default async function MusePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;

  const [
    { data: rawLeads, error: leadsError },
    { data: rawProjects, error: projectsError },
    { data: rawOpportunities, error: opportunitiesError },
    { data: rawDrafts, error: draftsError },
  ] = await Promise.all([
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
      .select(
        "id, kind, subject, body, lead_id, opportunity_id, project_id, status, created_at",
      )
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const drafts = draftsError ? [] : (rawDrafts ?? []);
  const ranked = rankLeads(
    (leadsError ? [] : (rawLeads ?? [])) as FlowkeepLead[],
  );
  const explanations = ranked.slice(0, 3).map((lead) => explainPriority(lead));
  const stale = findStaleLeads(ranked);
  const emailConfigured = isEmailConfigured();

  const projects = (projectsError ? [] : (rawProjects ?? [])) as {
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
  let riskReadFailed = false;
  for (const project of projects) {
    const [
      { data: milestones, error: milestonesError },
      { data: tasks, error: tasksError },
      { data: approvals, error: approvalsError },
    ] = await Promise.all([
      supabase
        .from("milestones")
        .select("title, status, due_date")
        .eq("project_id", project.id),
      supabase
        .from("tasks")
        .select("title, status, due_at")
        .eq("project_id", project.id),
      supabase
        .from("approvals")
        .select("id, decided_at")
        .eq("project_id", project.id),
    ]);
    if (milestonesError || tasksError || approvalsError) {
      riskReadFailed = true;
      continue;
    }
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
  const severity = { critical: 3, high: 2, watch: 1, low: 0 };
  const activeRisks = risks
    .filter((r) => r.level !== "low")
    .sort((a, b) => severity[b.level] - severity[a.level]);
  const focusUnavailable = Boolean(
    leadsError || projectsError || opportunitiesError || riskReadFailed,
  );
  const topRisk = activeRisks[0];

  const topOpportunity = (
    opportunitiesError ? [] : (rawOpportunities ?? [])
  )[0] as { id: string; title: string; score: number | null } | undefined;

  const recommendation = recommendNextAction({
    topLead: ranked[0],
    topRisk,
    topOpportunity,
    staleCount: stale.length,
  });

  // Draft composer: ?kind=follow_up&target=lead:<id>
  let preview: {
    subject: string;
    body: string;
    kind: MuseDraftKind;
    target: DraftTarget;
  } | null = null;
  const kindParam = DRAFT_KINDS.some((k) => k.value === params.kind)
    ? params.kind!
    : "follow_up";
  const targetParam = (params.target ?? "") as string;
  if (targetParam.split(":").length === 2) {
    const [targetType, targetId] = targetParam.split(":");
    let target: DraftTarget | null = null;
    if (targetType === "lead" && !leadsError) {
      const lead = (rawLeads ?? []).find((l) => l.id === targetId) as
        | FlowkeepLead
        | undefined;
      if (lead) target = { type: "lead", lead };
    } else if (targetType === "opportunity" && !opportunitiesError) {
      const opp = (rawOpportunities ?? []).find((o) => o.id === targetId) as
        | { title: string; source?: string | null; url?: string | null }
        | undefined;
      if (opp) target = { type: "opportunity", opportunity: opp };
    } else if (targetType === "project") {
      const project = projects.find((p) => p.id === targetId);
      if (project)
        target = {
          type: "project",
          project: {
            name: project.name,
            clientName: clientName(project.clients),
          },
        };
    }
    if (target) {
      const kind = kindParam as MuseDraftKind;
      const generated = buildDraftFromTarget(target, kind);
      preview = {
        subject: generated.subject,
        body: generated.body,
        kind,
        target,
      };
    }
  }

  const targetOptions: { value: string; label: string }[] = [
    ...ranked.slice(0, 10).map((l) => ({
      value: `lead:${l.id}`,
      label: `Lead — ${l.business_name}`,
    })),
    ...(opportunitiesError ? [] : (rawOpportunities ?? [])).map((o) => ({
      value: `opportunity:${o.id}`,
      label: `Opportunity — ${o.title}`,
    })),
    ...projects.map((p) => ({
      value: `project:${p.id}`,
      label: `Project — ${p.name}`,
    })),
  ];

  if (preview && !targetOptions.some((o) => o.value === targetParam)) {
    targetOptions.push({
      value: targetParam,
      label:
        preview.target.type === "lead"
          ? `Lead — ${preview.target.lead.business_name}`
          : "Selected target",
    });
  }
  const selectedTarget = preview ? targetParam : "";

  return (
    <div className="content-wrap management-page paperwork-page studio-page muse-workroom">
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow">Muse · Your studio companion</p>
          <h2>
            A clearer head.
            <br />
            <em>A sharper next move.</em>
          </h2>
          <p className="page-description">
            Find the work that needs you, understand why, and put the first
            words on the page.
          </p>
        </div>
        <Link href="/settings" className="management-text-link">
          Studio settings ↗
        </Link>
      </header>
      <nav className="management-destinations" aria-label="Muse destinations">
        <a href="#muse-focus">Studio focus</a>
        <a href="#muse-compose">Write a draft</a>
        <a href="#muse-saved">Saved drafts</a>
      </nav>
      <section
        id="muse-focus"
        aria-label="Top recommendation"
        className="studio-focus"
      >
        <p className="eyebrow">The one thing</p>
        {focusUnavailable ? (
          <>
            <h3>Your studio picture is incomplete.</h3>
            <DocumentNotice>
              Some lead, opportunity or project-risk data could not load.
              Refresh before relying on a top recommendation.
            </DocumentNotice>
            <Link href="/muse" className="management-text-link">
              Refresh Muse ↗
            </Link>
          </>
        ) : (
          <>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.detail}</p>
            <p className="studio-focus-why">
              <strong>Why this comes first</strong>
              {recommendation.why}
            </p>
            <Link
              className="management-primary-link"
              href={recommendation.href}
            >
              Take the next step <span aria-hidden="true">↗</span>
            </Link>
          </>
        )}
      </section>
      <div className="studio-intelligence-grid">
        <section aria-label="Prioritization explanations">
          <DocumentSectionHeading
            eyebrow="The reasoning"
            title="Priority, explained"
          />
          {leadsError ? (
            <DocumentNotice>Lead priorities could not load.</DocumentNotice>
          ) : explanations.length ? (
            explanations.map((exp) => (
              <article key={exp.leadId} className="studio-insight-row">
                <div className="studio-row-heading">
                  <h4>{exp.businessName}</h4>
                  <span className="studio-status">{exp.priorityLabel}</span>
                </div>
                <p>{exp.actionTitle}</p>
                <ul>
                  {exp.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
                <Link
                  className="management-text-link"
                  href={`/leads/${exp.leadId}`}
                >
                  Open lead ↗
                </Link>
              </article>
            ))
          ) : (
            <p className="management-help">
              No ranked leads yet. Capture a lead when the next conversation
              starts.
            </p>
          )}
        </section>
        <section aria-label="Project risk">
          <DocumentSectionHeading
            eyebrow="Delivery radar"
            title="What needs watching"
          />
          <p className="management-help">
            Checks the eight most recently updated projects.
          </p>
          {projectsError || riskReadFailed ? (
            <DocumentNotice>
              Project risk is unavailable or incomplete. Refresh to restore the
              missing checks.
            </DocumentNotice>
          ) : null}
          {activeRisks.map((risk) => (
            <article
              key={risk.projectId}
              className="studio-insight-row"
              data-risk={risk.level}
            >
              <div className="studio-row-heading">
                <h4>{risk.name}</h4>
                <span className="studio-status">{risk.level}</span>
              </div>
              <ul>
                {risk.factors.map((factor, i) => (
                  <li key={i}>{factor}</li>
                ))}
              </ul>
              <Link
                href={`/projects/${risk.projectId}`}
                className="management-text-link"
              >
                Open project ↗
              </Link>
            </article>
          ))}
          {!projectsError && !riskReadFailed && !activeRisks.length ? (
            <p className="management-help">
              No elevated risk flagged in the checked projects.
            </p>
          ) : null}
          <Link href="/projects" className="management-text-link">
            View the pipeline ↗
          </Link>
        </section>
      </div>
      <details id="stale" className="studio-disclosure">
        <summary>
          <span>Going quiet</span>
          <small>
            {leadsError
              ? "Unavailable"
              : `${stale.length} ${stale.length === 1 ? "lead" : "leads"} to revisit`}
          </small>
        </summary>
        {leadsError ? (
          <DocumentNotice>Quiet-lead checks could not load.</DocumentNotice>
        ) : stale.length ? (
          stale.slice(0, 8).map((s) => (
            <article key={s.leadId} className="studio-insight-row">
              <h4>{s.businessName}</h4>
              <p>{s.reason}</p>
              <div className="studio-actions">
                <Link
                  href={`/muse?kind=check_in&target=lead:${s.leadId}#muse-compose`}
                  className="management-text-link"
                >
                  Draft a check-in ↗
                </Link>
                <Link
                  href={`/leads/${s.leadId}`}
                  className="management-text-link"
                >
                  Open lead ↗
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className="management-help">
            No quiet leads flagged in the current list.
          </p>
        )}
      </details>
      <section
        id="muse-compose"
        aria-label="Draft composer"
        className="studio-compose"
      >
        <DocumentSectionHeading
          eyebrow="Put it into words"
          title="The first draft is yours to change."
        />
        <div className="studio-writing-grid">
          <div>
            {leadsError || projectsError || opportunitiesError ? (
              <DocumentNotice>
                Some draft targets could not load. Available targets are still
                listed.
              </DocumentNotice>
            ) : null}
            {params.target && !preview ? (
              <DocumentNotice>
                That draft target is unavailable. Choose an available target to
                start a draft.
              </DocumentNotice>
            ) : null}
            <form
              className="paperwork-form"
              method="get"
              action="/muse#muse-compose"
            >
              <div className="paperwork-form-grid">
                <label className="field">
                  <span>Draft kind</span>
                  <select
                    name="kind"
                    aria-label="Draft kind"
                    defaultValue={kindParam}
                  >
                    {DRAFT_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Target</span>
                  <select
                    name="target"
                    aria-label="Target"
                    required
                    defaultValue={selectedTarget}
                    disabled={!targetOptions.length}
                  >
                    <option value="" disabled>
                      Choose a lead, opportunity or project
                    </option>
                    {targetOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <button
                  className="mini-button go"
                  type="submit"
                  disabled={!targetOptions.length}
                >
                  Generate draft
                </button>
              </div>
            </form>
            {!targetOptions.length ? (
              <p className="management-help">
                Add a lead, opportunity or project to create a targeted draft.
              </p>
            ) : null}
            {preview ? (
              <form
                className="paperwork-form studio-preview"
                action={saveDraft}
              >
                <input type="hidden" name="kind" value={preview.kind} />
                <input type="hidden" name="target" value={targetParam} />
                {preview.target.type === "lead" ? (
                  <input
                    type="hidden"
                    name="lead_id"
                    value={preview.target.lead.id}
                  />
                ) : null}
                <label className="field">
                  <span>Subject</span>
                  <input
                    name="subject"
                    defaultValue={preview.subject}
                    required
                  />
                </label>
                <label className="field">
                  <span>Draft text</span>
                  <textarea
                    name="body"
                    aria-label="Draft text"
                    rows={14}
                    defaultValue={preview.body}
                    className="paperwork-body-editor"
                    required
                  />
                </label>
                <div>
                  <PortalSubmitButton pendingLabel="Saving draft…">
                    Save draft
                  </PortalSubmitButton>
                </div>
                <p className="management-help">
                  Saving keeps a draft in this studio. It does not send an
                  email.
                </p>
              </form>
            ) : null}
          </div>
          <aside className="studio-writing-note">
            <p className="eyebrow">A starting point, not the last word</p>
            <h4>You bring the judgment.</h4>
            <p>
              Muse uses recorded studio activity to suggest priorities and
              assemble draft text. Check names, scope, prices and promises
              before using it.
            </p>
            <p>
              Copy saved text to use elsewhere.{" "}
              {emailConfigured
                ? "Email settings are present. An individual Gmail send requires a recipient and Confirm send."
                : "Gmail sending is unavailable until email is configured."}
            </p>
            <Link
              href="/settings#studio-connections"
              className="management-text-link"
            >
              View connection status ↗
            </Link>
          </aside>
        </div>
      </section>
      <section
        id="muse-saved"
        aria-label="Saved drafts"
        className="studio-saved"
      >
        <DocumentSectionHeading
          eyebrow="Keep the useful words"
          title="Saved drafts"
          detail={
            draftsError
              ? "Unavailable"
              : `${drafts.length} recent ${drafts.length === 1 ? "draft" : "drafts"}`
          }
        />
        <p className="management-help">
          The ten most recent saved drafts. Open one to review its text before
          copying or sending.
        </p>
        {draftsError ? (
          <DocumentNotice>
            Saved drafts could not load. Refresh to try again.
          </DocumentNotice>
        ) : drafts.length ? (
          drafts.map((d) => (
            <details
              key={d.id}
              className="studio-saved-draft"
              data-draft-id={d.id}
            >
              <summary>
                <span>
                  <strong>{d.subject}</strong>
                  <small>
                    {d.kind.replaceAll("_", " ")} · {documentDate(d.created_at)}
                  </small>
                </span>
                <span aria-hidden="true">+</span>
              </summary>
              <div className="studio-draft-body">{d.body}</div>
              <div className="studio-actions">
                <CopyButton text={`${d.subject}\n\n${d.body}`} />
                {emailConfigured ? (
                  <details className="studio-send">
                    <summary className="mini-button">Send via Gmail</summary>
                    <form action={sendDraftEmail} className="paperwork-form">
                      <input type="hidden" name="draft_id" value={d.id} />
                      <label className="field">
                        <span>Recipient address</span>
                        <input
                          type="email"
                          name="to"
                          required
                          placeholder="recipient@example.com"
                        />
                      </label>
                      <p className="management-help">
                        This sends the saved text above to the address you
                        enter. Review both before confirming.
                      </p>
                      <div>
                        <PortalSubmitButton pendingLabel="Sending email…">
                          Confirm send
                        </PortalSubmitButton>
                      </div>
                    </form>
                  </details>
                ) : null}
                <form action={archiveDraft}>
                  <input type="hidden" name="id" value={d.id} />
                  <PortalSubmitButton
                    pendingLabel="Archiving…"
                    className="mini-button"
                  >
                    Archive draft
                  </PortalSubmitButton>
                </form>
              </div>
            </details>
          ))
        ) : (
          <p className="management-help">
            No saved drafts yet. Start with a target above, then save the
            version you want to keep.
          </p>
        )}
      </section>
    </div>
  );
}
