import {
  createTaskWithFeedback,
  deleteTaskWithFeedback,
  setTaskStatusWithFeedback,
  toggleTaskVisibilityWithFeedback,
} from "@/app/(protected)/(admin)/projects/actions";
import type { ProjectTask } from "@/lib/supabase/types";
import { PortalActionForm } from "@/components/portal/PortalActionForm";

function pillClass(status: string) {
  if (status === "complete") return "delivery-pill done";
  if (status === "in_progress") return "delivery-pill progress";
  if (status === "blocked") return "delivery-pill blocked";
  return "delivery-pill";
}

function statusLabel(status: string) {
  switch (status) {
    case "in_progress": return "In progress";
    case "complete": return "Complete";
    case "blocked": return "Blocked";
    default: return "Not started";
  }
}

function estimate(value: number | null) {
  if (!value) return null;
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60), minutes = value % 60;
  return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
}

function TaskRow({ task, children = 0, subtask = false }: { task: ProjectTask; children?: number; subtask?: boolean }) {
  const detail = [
    task.priority !== "normal" ? `${task.priority} priority` : null,
    task.due_at ? `Due ${new Date(task.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date",
    estimate(task.estimated_minutes) ? `${estimate(task.estimated_minutes)} focus` : null,
  ].filter(Boolean).join(" · ");
  return <li className={`delivery-row muse-task-row${subtask ? " muse-subtask-row" : ""}`}>
    <div className="delivery-row-main">
      <div className="muse-task-title-line">
        {subtask && <span aria-hidden="true">↳</span>}
        <p className="delivery-row-title">{task.title}</p>
        {task.source === "muse" && <span className="muse-created-pill">Muse</span>}
      </div>
      <p className="delivery-row-sub">{detail}</p>
      {(task.description || task.definition_of_done) && <details className="muse-task-guidance">
        <summary>Guidance & definition of done</summary>
        {task.description && <p>{task.description}</p>}
        {task.definition_of_done && <p><strong>Done:</strong> {task.definition_of_done}</p>}
      </details>}
    </div>
    {task.client_visible ? <span className="delivery-pill visible">Client sees this</span> : null}
    <span className={pillClass(task.status)}>{statusLabel(task.status)}</span>
    <div className="delivery-actions">
      <PortalActionForm action={setTaskStatusWithFeedback} lockOnSuccess={false} pendingMessage="Saving status…" className="mini-form">
        <input type="hidden" name="task_id" value={task.id} />
        <select name="status" defaultValue={task.status} aria-label={`Status for ${task.title}`}>
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="complete">Complete</option>
        </select>
        <button type="submit" className="mini-button">Set</button>
      </PortalActionForm>
      <PortalActionForm action={toggleTaskVisibilityWithFeedback} lockOnSuccess={false} pendingMessage="Saving visibility…">
        <input type="hidden" name="task_id" value={task.id} />
        <input type="hidden" name="client_visible" value={String(!task.client_visible)} />
        <button type="submit" className="mini-button" title={task.client_visible ? "Hide from client" : "Show to client"}
          aria-label={`${task.client_visible ? "Hide" : "Show"} ${task.title} ${task.client_visible ? "from" : "to"} client`}>
          {task.client_visible ? "👁" : "👁‍🗨"}
        </button>
      </PortalActionForm>
      <PortalActionForm action={deleteTaskWithFeedback} pendingMessage="Deleting task…"
        confirmMessage={`Delete “${task.title}”? This permanently removes the task and cannot be undone.`}>
        <input type="hidden" name="task_id" value={task.id} />
        <button type="submit" className="mini-button danger" disabled={children > 0}
          title={children > 0 ? "Remove subtasks first" : "Delete task"} aria-label={`Delete ${task.title}`}>✕</button>
      </PortalActionForm>
    </div>
  </li>;
}

function TaskFields({ projectId, parentTaskId }: { projectId: string; parentTaskId?: string }) {
  return <PortalActionForm action={createTaskWithFeedback} className="muse-task-create-form" lockOnSuccess={false} resetOnSuccess pendingMessage="Adding task…">
    <input type="hidden" name="project_id" value={projectId} />
    {parentTaskId && <input type="hidden" name="parent_task_id" value={parentTaskId} />}
    <div className="muse-task-create-grid">
      <label><span>{parentTaskId ? "Subtask" : "Task"}</span><input type="text" name="title" placeholder={parentTaskId ? "A clear executable step" : "A meaningful deliverable"} required maxLength={160} /></label>
      <label><span>Priority</span><select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
      <label><span>Due</span><input type="date" name="due_at" /></label>
      <label><span>Focus minutes</span><input type="number" name="estimated_minutes" min={5} max={1440} step={5} placeholder="45" /></label>
    </div>
    <label><span>Guidance</span><textarea name="description" maxLength={1200} rows={2} placeholder="What needs to happen?" /></label>
    <label><span>Definition of done</span><textarea name="definition_of_done" maxLength={600} rows={2} placeholder="What observable result means this is finished?" /></label>
    <label className="muse-task-client-toggle"><input type="checkbox" name="client_visible" /> Client-visible</label>
    <button type="submit" className="mini-button go">Add {parentTaskId ? "subtask" : "task"}</button>
  </PortalActionForm>;
}

export function TaskSection({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const open = tasks.filter(task => task.status !== "complete").length;
  const parents = tasks.filter(task => !task.parent_task_id).sort((a, b) => a.position - b.position);
  const children = new Map<string, ProjectTask[]>();
  for (const task of tasks.filter(task => task.parent_task_id)) {
    const group = children.get(task.parent_task_id!) ?? [];
    group.push(task); children.set(task.parent_task_id!, group);
  }
  for (const group of children.values()) group.sort((a, b) => a.position - b.position);

  return <section className="panel muse-task-section" aria-label="Tasks and subtasks">
    <div className="panel-heading"><div><h3>Tasks & subtasks</h3><p className="delivery-row-sub">Structured work with guidance kept behind the details.</p></div><span className="pipeline-count">{open} open</span></div>
    <ul className="delivery-list">
      {parents.length === 0 ? <li className="delivery-row"><p className="pipeline-empty">No tasks. Either you&apos;re done or the plan is still haunting the hallway.</p></li> : parents.map(parent => {
        const subtasks = children.get(parent.id) ?? [];
        return <li className="muse-task-group" key={parent.id}>
          <ul><TaskRow task={parent} children={subtasks.length} />{subtasks.map(task => <TaskRow key={task.id} task={task} subtask />)}</ul>
          <details className="muse-add-subtask"><summary>+ Add subtask beneath {parent.title}</summary><TaskFields projectId={projectId} parentTaskId={parent.id} /></details>
        </li>;
      })}
    </ul>
    <details className="muse-add-root-task"><summary>+ Add a task manually</summary><TaskFields projectId={projectId} /></details>
  </section>;
}
