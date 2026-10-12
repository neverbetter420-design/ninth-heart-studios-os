import {
  createTask,
  deleteTask,
  setTaskStatus,
  toggleTaskVisibility,
} from "@/app/(protected)/(admin)/projects/actions";
import type { ProjectTask } from "@/lib/supabase/types";

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

export function TaskSection({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: ProjectTask[];
}) {
  const open = tasks.filter((t) => t.status !== "complete").length;
  return (
    <section className="panel" aria-label="Tasks">
      <div className="panel-heading">
        <h3>Tasks</h3>
        <span className="pipeline-count">{open} open</span>
      </div>
      <ul className="delivery-list">
        {tasks.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">No tasks. Either you&apos;re done or you&apos;re in denial.</p>
          </li>
        ) : (
          tasks.map((t) => (
            <li key={t.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{t.title}</p>
                <p className="delivery-row-sub">
                  {t.priority !== "normal" ? `${t.priority} priority · ` : ""}
                  {t.due_at
                    ? `Due ${new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "No due date"}
                </p>
              </div>
              {t.client_visible ? <span className="delivery-pill visible">Client sees this</span> : null}
              <span className={pillClass(t.status)}>{statusLabel(t.status)}</span>
              <div className="delivery-actions">
                <form action={setTaskStatus} className="mini-form">
                  <input type="hidden" name="task_id" value={t.id} />
                  <select name="status" defaultValue={t.status} aria-label={`Status for ${t.title}`}>
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="complete">Complete</option>
                  </select>
                  <button type="submit" className="mini-button">Set</button>
                </form>
                <form action={toggleTaskVisibility}>
                  <input type="hidden" name="task_id" value={t.id} />
                  <button
                    type="submit"
                    className="mini-button"
                    title={t.client_visible ? "Hide from client" : "Show to client"}
                  >
                    {t.client_visible ? "👁" : "👁‍🗨"}
                  </button>
                </form>
                <form action={deleteTask}>
                  <input type="hidden" name="task_id" value={t.id} />
                  <button type="submit" className="mini-button danger" aria-label={`Delete ${t.title}`}>✕</button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>
      <form action={createTask} className="delivery-add-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="text" name="title" placeholder="New task…" required maxLength={160} />
        <select name="priority" defaultValue="normal" aria-label="Priority">
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <input type="date" name="due_at" aria-label="Task due date" />
        <label className="mini-form" style={{ fontSize: 10, color: "#84798c" }}>
          <input type="checkbox" name="client_visible" /> Client-visible
        </label>
        <button type="submit" className="mini-button go">Add</button>
      </form>
    </section>
  );
}
