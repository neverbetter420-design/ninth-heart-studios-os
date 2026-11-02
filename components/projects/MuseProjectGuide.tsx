"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MusePlanEditor } from "./MusePlanEditor";
import { MuseRevisionHistory } from "./MuseRevisionHistory";
import { parseMuseProjectPlan, type MuseProjectPlan, type ProjectHeartbeat } from "@/lib/muse-project-guide";

type DraftPlan = MuseProjectPlan & { plan_id: string; revision: number; expires_at: string };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

// Never trust the shape, identity or lifetime of a draft returned to the browser.
function validatedDraft(response: Record<string, unknown>): DraftPlan {
  const planId = typeof response.plan_id === "string" ? response.plan_id : "";
  const expires = typeof response.expires_at === "string" ? Date.parse(response.expires_at) : NaN;
  const revision = response.revision;
  if (!UUID.test(planId) || !Number.isSafeInteger(revision) || Number(revision) < 1 || Number(revision) > 25 || !Number.isFinite(expires) || expires <= Date.now()) {
    throw new Error("Muse returned an invalid or expired draft. No tasks were created.");
  }
  let parsed: MuseProjectPlan;
  try { parsed = parseMuseProjectPlan(response); }
  catch { throw new Error("Muse returned an invalid project plan. No tasks were created."); }
  return { ...parsed, plan_id: planId, revision: Number(revision), expires_at: response.expires_at as string };
}

function clientVisibleCount(plan: MuseProjectPlan) {
  return plan.tasks.reduce((count, task) => count + Number(task.client_visible)
    + task.subtasks.filter(subtask => subtask.client_visible).length, 0);
}

function taskCount(plan: MuseProjectPlan) {
  return plan.tasks.length + plan.tasks.reduce((sum, task) => sum + task.subtasks.length, 0);
}

function minutes(value: number | null) {
  if (!value) return null;
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60), remainder = value % 60;
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

export function MuseProjectGuide({
  projectId,
  projectName,
  heartbeat,
  enabled,
}: {
  projectId: string;
  projectName: string;
  heartbeat: ProjectHeartbeat;
  enabled: boolean;
}) {
  const router = useRouter();
  const [objective, setObjective] = useState(`Build the next practical development plan for ${projectName}.`);
  const [plan, setPlan] = useState<DraftPlan | null>(null);
  const [busy, setBusy] = useState<"draft" | "apply" | "save" | "load" | null>(null);
  const [editing, setEditing] = useState(false);
  const [restoreSeed, setRestoreSeed] = useState<{ source: number; draft: MuseProjectPlan } | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<number | null>(null);

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/muse-ai/project-plan", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Muse Project Guide is unavailable.");
    return data;
  }

  async function draft(event: FormEvent) {
    event.preventDefault();
    if (!enabled || busy || objective.trim().length < 2) return;
    setBusy("draft"); setError(""); setCreated(null); setPlan(null); setEditing(false); setRestoreSeed(null); setSaveNotice("");
    try {
      const data = await call({ action: "draft", project_id: projectId, objective: objective.trim() });
      setPlan(validatedDraft(data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Muse couldn't prepare the plan.");
    } finally { setBusy(null); }
  }

  async function loadLatest() {
    if (!enabled || busy || editing) return;
    setBusy("load"); setError(""); setPlan(null); setRestoreSeed(null); setSaveNotice(""); setCreated(null);
    try {
      const data = await call({ action: "load_latest", project_id: projectId });
      if (data.project_id !== projectId) throw new Error("Saved plan belongs to a different project.");
      setPlan(validatedDraft(data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't reopen the saved draft.");
    } finally { setBusy(null); }
  }

  async function saveRevision(next: MuseProjectPlan, changeNote: string) {
    if (!enabled || !plan || busy || !editing) return;
    const previous = plan;
    setBusy("save"); setError(""); setSaveNotice("");
    try {
      const data = await call({ action: "save_revision", project_id: projectId,
        plan_id: previous.plan_id, expected_revision: previous.revision,
        plan: next, change_note: changeNote });
      if (data.plan_id !== previous.plan_id || data.project_id !== projectId ||
          data.revision !== previous.revision + 1) throw new Error("Unexpected revision receipt.");
      const saved = validatedDraft(data);
      if (JSON.stringify({ summary: saved.summary, tasks: saved.tasks }) !==
          JSON.stringify({ summary: next.summary, tasks: next.tasks })) throw new Error("Saved plan differs from reviewed edits.");
      setPlan(saved); setEditing(false); setRestoreSeed(null);
      setSaveNotice(`Saved revision ${saved.revision}. No project tasks were created.`);
    } catch (cause) {
      // Network failures are indeterminate: the database may already have
      // committed. Never approve from this browser snapshot; reload from server.
      setPlan(null); setEditing(false); setRestoreSeed(null);
      setError("Save was not confirmed. Reopen the latest saved draft before editing or approving. "
        + (cause instanceof Error ? cause.message : ""));
    } finally { setBusy(null); }
  }

  function restoreHistoryVersion(snapshot: MuseProjectPlan, source: number) {
    if (!enabled || !plan || busy || editing || plan.revision >= 25 ||
      !Number.isSafeInteger(source) || source < 1 || source >= plan.revision) return;
    setRestoreSeed({ source, draft: snapshot });
    setSaveNotice("");
    setEditing(true);
  }

  async function apply() {
    if (!enabled || !plan || busy || editing) return;
    if (Date.parse(plan.expires_at) <= Date.now()) {
      setPlan(null);
      setError("This plan has expired. Draft a fresh plan before approving any tasks.");
      return;
    }
    const count = taskCount(plan);
    if (!window.confirm(`Approve revision ${plan.revision} with exactly ${count} reviewed tasks? This changes the project task list.`)) return;
    setBusy("apply"); setError("");
    try {
      const data = await call({ action: "apply", project_id: projectId, plan_id: plan.plan_id,
        expected_revision: plan.revision, expected_count: count });
      if (data.plan_id !== plan.plan_id || data.applied_revision !== plan.revision || data.created_count !== count) {
        setPlan(null);
        throw new Error("Muse returned an unexpected approval receipt. Review the project task list before retrying.");
      }
      setCreated(count); setPlan(null); setSaveNotice("");
      router.refresh();
    } catch (cause) {
      // If the network dropped after a commit we cannot assert the task list.
      // Close the approval controls until the user reloads from the server.
      setPlan(null); setSaveNotice("");
      setError("Approval status is unconfirmed. Review the project task list before retrying. "
        + (cause instanceof Error ? cause.message : ""));
    } finally { setBusy(null); }
  }

  const meter = { "--heartbeat": `${heartbeat.score * 3.6}deg` } as CSSProperties;
  return (
    <section className="muse-project-guide" aria-labelledby="muse-project-guide-title">
      <div className="muse-guide-intro">
        <div>
          <p className="eyebrow electric">Muse · Project Guide</p>
          <h3 id="muse-project-guide-title">Strategy with a pulse.</h3>
          <p>One meaningful move, a visible health signal, and no AI busywork breeding in the dark.</p>
        </div>
        <div className="muse-heartbeat" style={meter} aria-label={`Project heartbeat ${heartbeat.score} out of 100: ${heartbeat.label}`}>
          <span><strong>{heartbeat.score}</strong><small>{heartbeat.label}</small></span>
        </div>
      </div>

      <div className="muse-guide-signal-grid">
        <article className="muse-one-move">
          <p className="muse-guide-kicker">ONE MOVE</p>
          {heartbeat.oneMove ? <>
            <h4>{heartbeat.oneMove.title}</h4>
            <p>
              {heartbeat.oneMove.status === "blocked" ? "This is blocked—the first move is removing the obstruction." : "The strongest recorded next move right now."}
              {heartbeat.oneMove.estimated_minutes ? ` Working focus: ${minutes(heartbeat.oneMove.estimated_minutes)}.` : ""}
            </p>
          </> : <><h4>The task list is quiet.</h4><p>Create a plan before the void starts assigning its own priorities.</p></>}
        </article>
        <div className="muse-heartbeat-reasons">
          <p className="muse-guide-kicker">HEARTBEAT EVIDENCE</p>
          <ul>{heartbeat.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
          <p>{heartbeat.open} open · {heartbeat.blocked} blocked · {heartbeat.overdue} overdue</p>
        </div>
      </div>

      <form className="muse-plan-builder" onSubmit={draft}>
        <div>
          <label htmlFor="muse-plan-objective">What are we building or fixing?</label>
          <textarea id="muse-plan-objective" value={objective} onChange={event => setObjective(event.target.value)}
            minLength={2} maxLength={500} rows={3} disabled={!enabled || !!busy} />
        </div>
        <button type="submit" className="mini-button go" disabled={!enabled || !!busy || objective.trim().length < 2}>
          {busy === "draft" ? "Muse is shaping the plan…" : "Draft the project plan"}
        </button>
        <p className="muse-plan-boundary">
          {enabled ? "Draft only. Nothing is created until you review the exact plan and approve it." : "Private preview is installed but disabled pending activation and release approval."}
        </p>
      </form>
      <div className="muse-plan-reopen">
        <button type="button" className="mini-button" disabled={!enabled || !!busy || editing}
          onClick={loadLatest}>{busy === "load" ? "Loading saved draft…" : "Reopen latest saved draft"}</button>
        <span>Securely loads your most recent unexpired revision. No AI request or new tasks.</span>
      </div>

      {error && <p className="muse-guide-error" role="alert">{error}</p>}
      {created !== null && <p className="muse-guide-success" role="status">Created {created} approved {created === 1 ? "task" : "tasks"}.</p>}
      {saveNotice && <p className="muse-guide-success" role="status">{saveNotice}</p>}

      {plan && editing && <MusePlanEditor
        key={`${plan.plan_id}:${plan.revision}:${restoreSeed?.source ?? "current"}`}
        original={{ summary: plan.summary, tasks: plan.tasks }}
        initialDraft={restoreSeed?.draft}
        revision={plan.revision} expiresAt={plan.expires_at} saving={busy === "save"}
        onCancel={() => { setEditing(false); setRestoreSeed(null); }} onSave={saveRevision}
      />}

      {plan && !editing && <div className="muse-plan-preview" aria-live="polite">
        <div className="muse-plan-preview-head">
          <div><p className="muse-guide-kicker">PROPOSED · NOTHING CREATED</p><h4>{plan.summary}</h4></div>
          <span>Revision {plan.revision} · {taskCount(plan)} total tasks</span>
        </div>
        <p className="muse-plan-review-note">
          Review every task before approval · {clientVisibleCount(plan)} client-visible ·
          Draft expires {new Date(plan.expires_at).toLocaleString()}.
        </p>
        <MuseRevisionHistory key={`${plan.plan_id}:${plan.revision}`}
          planId={plan.plan_id} projectId={projectId} currentRevision={plan.revision}
          currentPlan={{ summary: plan.summary, tasks: plan.tasks }} disabled={!enabled || !!busy}
          call={call} onRestore={restoreHistoryVersion}
        />
        <ol className="muse-plan-list">
          {plan.tasks.map((task, index) => <li key={`${task.title}-${index}`}>
            <div className="muse-plan-task-head"><strong>{task.title}</strong><span>{task.priority}{task.estimated_minutes ? ` · ${minutes(task.estimated_minutes)}` : ""}</span></div>
            <div className="muse-plan-task-meta">
              {task.due_date && <span>Due {task.due_date}</span>}
              <span className={task.client_visible ? "muse-plan-visibility-visible" : "muse-plan-visibility-private"}>
                {task.client_visible ? "Visible to client" : "Studio-only"}
              </span>
            </div>
            <p>{task.description}</p>
            <p className="muse-done-definition"><b>Done:</b> {task.definition_of_done}</p>
            {!!task.subtasks.length && <ul>{task.subtasks.map((subtask, subIndex) => <li key={`${subtask.title}-${subIndex}`}>
              <strong>{subtask.title}</strong>
              <p>{subtask.description}</p>
              <p className="muse-done-definition"><b>Done:</b> {subtask.definition_of_done}</p>
              <div className="muse-plan-task-meta">
                <span>{subtask.priority}{subtask.estimated_minutes ? ` · ${minutes(subtask.estimated_minutes)}` : ""}</span>
                {subtask.due_date && <span>Due {subtask.due_date}</span>}
                <span className={subtask.client_visible ? "muse-plan-visibility-visible" : "muse-plan-visibility-private"}>
                  {subtask.client_visible ? "Visible to client" : "Studio-only"}
                </span>
              </div>
            </li>)}</ul>}
          </li>)}
        </ol>
        <div className="muse-plan-approval">
          <button type="button" className="mini-button" onClick={() => setPlan(null)} disabled={!!busy}>Close preview</button>
          <button type="button" className="mini-button" onClick={() => { setRestoreSeed(null); setEditing(true); setSaveNotice(""); }}
            disabled={!enabled || !!busy || plan.revision >= 25}>Edit proposed tasks</button>
          <button type="button" className="mini-button go" onClick={apply} disabled={!!busy}>
            {busy === "apply" ? "Creating approved plan…" : `Approve & create ${taskCount(plan)} tasks`}
          </button>
        </div>
      </div>}
    </section>
  );
}
