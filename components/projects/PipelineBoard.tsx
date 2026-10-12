import Link from "next/link";
import { moveProject } from "@/app/(protected)/(admin)/projects/actions";
import {
  ON_HOLD_STAGE,
  PIPELINE_STAGES,
  stageLabel,
} from "@/lib/delivery";
import type { ProjectWithClient } from "@/lib/supabase/types";

const ALL_STAGES = [...PIPELINE_STAGES.map((s) => s.key), ON_HOLD_STAGE];

function dueState(dueDate: string | null): "overdue" | "soon" | null {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "overdue";
  if (days <= 7) return "soon";
  return null;
}

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const due = new Date(dueDate + "T00:00:00");
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PipelineBoard({ projects }: { projects: ProjectWithClient[] }) {
  return (
    <div className="pipeline-board" role="list" aria-label="Project pipeline">
      {ALL_STAGES.map((stage) => {
        const column = projects.filter((p) =>
          stage === ON_HOLD_STAGE ? p.status === ON_HOLD_STAGE : p.status === stage
        );
        // Catch projects with unknown statuses in the first column
        const extras =
          stage === PIPELINE_STAGES[0].key
            ? projects.filter((p) => !ALL_STAGES.includes(p.status))
            : [];
        const cards = [...column, ...extras];
        return (
          <section key={stage} className="pipeline-column" role="listitem" aria-label={stageLabel(stage)}>
            <div className="pipeline-column-head">
              <h3>{stageLabel(stage)}</h3>
              <span className="pipeline-count">{cards.length}</span>
            </div>
            <div className="pipeline-cards">
              {cards.length === 0 ? (
                <p className="pipeline-empty">Nothing here. Suspiciously calm.</p>
              ) : (
                cards.map((project) => {
                  const due = dueState(project.due_date);
                  return (
                    <article key={project.id} className="pipeline-card">
                      <div className="pipeline-card-top">
                        <h4 className="pipeline-card-name">
                          <Link href={`/projects/${project.id}`}>{project.name}</Link>
                        </h4>
                      </div>
                      {project.client_name ? (
                        <p className="pipeline-card-client">{project.client_name}</p>
                      ) : null}
                      <div className="progress-track" aria-label={`${project.progress}% complete`}>
                        <span style={{ width: `${project.progress}%` }} />
                      </div>
                      <div className="pipeline-card-meta">
                        <span className={due === "overdue" ? "pipeline-due-over" : undefined}>
                          {due === "overdue" ? "Overdue · " : ""}
                          {formatDue(project.due_date)}
                        </span>
                        <span>{project.progress}%</span>
                      </div>
                      <form action={moveProject} className="pipeline-move-form">
                        <input type="hidden" name="project_id" value={project.id} />
                        <select name="status" defaultValue={project.status} aria-label={`Move ${project.name} to stage`}>
                          {ALL_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {stageLabel(s)}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="mini-button">
                          Move
                        </button>
                      </form>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
