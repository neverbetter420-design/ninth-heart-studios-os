import {
  createMilestone,
  deleteMilestone,
  setMilestoneStatus,
} from "@/app/(protected)/(admin)/projects/actions";
import { milestoneStatusLabel } from "@/lib/delivery";
import type { Milestone } from "@/lib/supabase/types";

function pillClass(status: string) {
  if (status === "complete") return "delivery-pill done";
  if (status === "in_progress") return "delivery-pill progress";
  return "delivery-pill";
}

export function MilestoneSection({
  projectId,
  milestones,
}: {
  projectId: string;
  milestones: Milestone[];
}) {
  return (
    <section className="panel" aria-label="Milestones">
      <div className="panel-heading">
        <h3>Milestones</h3>
        <span className="pipeline-count">
          {milestones.filter((m) => m.status === "complete").length}/{milestones.length}
        </span>
      </div>
      <ul className="delivery-list">
        {milestones.length === 0 ? (
          <li className="delivery-row">
            <p className="pipeline-empty">No milestones yet. Break the beast into pieces.</p>
          </li>
        ) : (
          milestones.map((m) => (
            <li key={m.id} className="delivery-row">
              <div className="delivery-row-main">
                <p className="delivery-row-title">{m.title}</p>
                {m.due_date ? (
                  <p className="delivery-row-sub">
                    Due {new Date(m.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                ) : null}
              </div>
              <span className={pillClass(m.status)}>{milestoneStatusLabel(m.status)}</span>
              <div className="delivery-actions">
                <form action={setMilestoneStatus} className="mini-form">
                  <input type="hidden" name="milestone_id" value={m.id} />
                  <select name="status" defaultValue={m.status} aria-label={`Status for ${m.title}`}>
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="complete">Complete</option>
                  </select>
                  <button type="submit" className="mini-button">Set</button>
                </form>
                <form action={deleteMilestone}>
                  <input type="hidden" name="milestone_id" value={m.id} />
                  <button type="submit" className="mini-button danger" aria-label={`Delete ${m.title}`}>✕</button>
                </form>
              </div>
            </li>
          ))
        )}
      </ul>
      <form action={createMilestone} className="delivery-add-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="text" name="title" placeholder="New milestone…" required maxLength={120} />
        <input type="date" name="due_date" aria-label="Milestone due date" />
        <button type="submit" className="mini-button go">Add</button>
      </form>
    </section>
  );
}
