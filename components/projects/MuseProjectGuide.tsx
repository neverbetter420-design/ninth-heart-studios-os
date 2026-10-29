"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MuseProjectPlan, ProjectHeartbeat } from "@/lib/muse-project-guide";

type DraftPlan = MuseProjectPlan & { plan_id: string; expires_at: string };

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
  const [busy, setBusy] = useState<"draft" | "apply" | null>(null);
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
    setBusy("draft"); setError(""); setCreated(null); setPlan(null);
    try {
      const data = await call({ action: "draft", project_id: projectId, objective: objective.trim() });
      setPlan(data as unknown as DraftPlan);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Muse couldn't prepare the plan.");
    } finally { setBusy(null); }
  }

  async function apply() {
    if (!plan || busy) return;
    const count = taskCount(plan);
    if (!window.confirm(`Create the exact ${count}-task Muse plan you reviewed? This changes the project task list.`)) return;
    setBusy("apply"); setError("");
    try {
      const data = await call({ action: "apply", project_id: projectId, plan_id: plan.plan_id });
      const countCreated = typeof data.created_count === "number" ? data.created_count : count;
      setCreated(countCreated); setPlan(null);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Muse couldn't apply the plan.");
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

      {error && <p className="muse-guide-error" role="alert">{error}</p>}
      {created !== null && <p className="muse-guide-success" role="status">Created {created} approved {created === 1 ? "task" : "tasks"}.</p>}

      {plan && <div className="muse-plan-preview" aria-live="polite">
        <div className="muse-plan-preview-head">
          <div><p className="muse-guide-kicker">PROPOSED · NOTHING CREATED</p><h4>{plan.summary}</h4></div>
          <span>{taskCount(plan)} total tasks</span>
        </div>
        <ol className="muse-plan-list">
          {plan.tasks.map((task, index) => <li key={`${task.title}-${index}`}>
            <div className="muse-plan-task-head"><strong>{task.title}</strong><span>{task.priority}{task.estimated_minutes ? ` · ${minutes(task.estimated_minutes)}` : ""}</span></div>
            <p>{task.description}</p>
            <p className="muse-done-definition"><b>Done:</b> {task.definition_of_done}</p>
            {!!task.subtasks.length && <ul>{task.subtasks.map((subtask, subIndex) => <li key={`${subtask.title}-${subIndex}`}>
              <strong>{subtask.title}</strong><span>{subtask.description}</span>
            </li>)}</ul>}
          </li>)}
        </ol>
        <div className="muse-plan-approval">
          <button type="button" className="mini-button" onClick={() => setPlan(null)} disabled={!!busy}>Discard</button>
          <button type="button" className="mini-button go" onClick={apply} disabled={!!busy}>
            {busy === "apply" ? "Creating approved plan…" : `Approve & create ${taskCount(plan)} tasks`}
          </button>
        </div>
      </div>}
    </section>
  );
}
