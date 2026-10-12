import Link from "next/link";
import { updateProjectDetails } from "@/app/(protected)/(admin)/projects/actions";
import { stageLabel } from "@/lib/delivery";

type Props = {
  project: {
    id: string;
    name: string;
    status: string;
    progress: number;
    due_date: string | null;
    internal_notes: string | null;
  };
  clientName: string | null;
};

export function ProjectOverview({ project, clientName }: Props) {
  return (
    <div className="workspace-head">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/projects" className="text-button">← Project Pipeline</Link>
      </div>
      <div className="workspace-title-row">
        <div>
          <p className="eyebrow electric">{clientName ?? "No client"} · Project workspace</p>
          <h2 style={{ margin: "6px 0 8px" }}>{project.name}</h2>
          <span className="stage-badge">{stageLabel(project.status)}</span>
        </div>
        <div style={{ minWidth: 220 }}>
          <div className="progress-track" aria-label={`${project.progress}% complete`}>
            <span style={{ width: `${project.progress}%` }} />
          </div>
          <p className="delivery-row-sub" style={{ marginTop: 6, textAlign: "right" }}>
            {project.progress}% ·{" "}
            {project.due_date
              ? `Due ${new Date(project.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
              : "No due date"}
          </p>
        </div>
      </div>

      <details className="panel" style={{ marginTop: 14 }}>
        <summary
          className="panel-heading"
          style={{ cursor: "pointer", listStyle: "none" }}
        >
          <h3>Project details</h3>
          <span className="pipeline-count">Edit</span>
        </summary>
        <form action={updateProjectDetails} style={{ padding: "14px 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="hidden" name="project_id" value={project.id} />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label className="field" style={{ minWidth: 120 }}>
              <span>Progress %</span>
              <input type="number" name="progress" min={0} max={100} defaultValue={project.progress} />
            </label>
            <label className="field" style={{ minWidth: 160 }}>
              <span>Due date</span>
              <input type="date" name="due_date" defaultValue={project.due_date ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Internal notes (never client-visible)</span>
            <textarea name="internal_notes" className="notes-area" defaultValue={project.internal_notes ?? ""} />
          </label>
          <div>
            <button type="submit" className="mini-button go">Save details</button>
          </div>
        </form>
      </details>
    </div>
  );
}
