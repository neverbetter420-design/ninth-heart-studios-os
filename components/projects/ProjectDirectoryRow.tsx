import Link from "next/link";
import { moveProjectWithFeedback } from "@/app/(protected)/(admin)/projects/actions";
import { PortalActionForm } from "@/components/portal/PortalActionForm";
import { ON_HOLD_STAGE, PIPELINE_STAGES, stageLabel } from "@/lib/delivery";
import { displayProgress, formatProjectDate, projectDueState } from "@/lib/project-display";
import type { ProjectWithClient } from "@/lib/supabase/types";

const STAGES: string[] = [...PIPELINE_STAGES.map(s => s.key), ON_HOLD_STAGE];

export function ProjectDirectoryRow({ project, allowMove = false, showClient = false }: { project: ProjectWithClient; allowMove?: boolean; showClient?: boolean }) {
  const progress = displayProgress(project.progress);
  const due = project.status === ON_HOLD_STAGE ? null : projectDueState(project.due_date);
  const known = STAGES.includes(project.status);
  return (
    <article className="management-project-row" data-project-id={project.id}>
      <div className="management-project-copy">
        <h4><Link href={`/projects/${project.id}`}>{project.name}<span aria-hidden="true">↗</span></Link></h4>
        <p>{showClient ? project.client_name ?? "Client not linked" : known ? stageLabel(project.status) : "Phase needs review"}</p>
      </div>
      <div className="management-project-progress">
        <div><span className={due ? `management-due-${due}` : undefined}>{due === "overdue" ? "Overdue · " : due === "soon" ? "Due soon · " : ""}{formatProjectDate(project.due_date)}</span><strong>{progress}%</strong></div>
        <div className="progress-track" role="progressbar" aria-label={`Recorded progress for ${project.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
      </div>
      {allowMove ? (
        <details className="pipeline-move-disclosure">
          <summary>Change phase <span aria-hidden="true">+</span></summary>
          <PortalActionForm action={moveProjectWithFeedback} lockOnSuccess={false} announceSuccess pendingMessage="Moving project…" className="pipeline-move-form">
            <input type="hidden" name="project_id" value={project.id} />
            <label className="field">
              <span>Move to</span>
              <select name="status" defaultValue={known ? project.status : ""} aria-label={`Move ${project.name} to stage`} required>
                {!known && <option value="" disabled>Choose a phase</option>}
                {STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
              </select>
            </label>
            <button type="submit" className="mini-button">Move</button>
          </PortalActionForm>
        </details>
      ) : null}
    </article>
  );
}
