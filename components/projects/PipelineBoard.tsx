import { ON_HOLD_STAGE, PIPELINE_STAGES } from "@/lib/delivery";
import { ProjectDirectoryRow } from "@/components/projects/ProjectDirectoryRow";
import type { ProjectWithClient } from "@/lib/supabase/types";

const STAGES = [...PIPELINE_STAGES, { key: ON_HOLD_STAGE, label: "On Hold" }];

export function PipelineBoard({ projects }: { projects: ProjectWithClient[] }) {
  if (!projects.length) return <div className="management-empty"><h3>A clear space for what comes next.</h3><p>Create a project above to begin its journey from Discovery to Care.</p></div>;
  const unknown = projects.filter(p => !STAGES.some(s => s.key === p.status));
  return (
    <>
      <nav className="pipeline-phase-nav" aria-label="Pipeline phases">
        {STAGES.map(stage => <a key={stage.key} href={`#phase-${stage.key}`}><span>{stage.label}</span><b>{projects.filter(p => p.status === stage.key).length}</b></a>)}
        {unknown.length > 0 && <a href="#phase-unassigned"><span>Needs a phase</span><b>{unknown.length}</b></a>}
      </nav>
      <div className="pipeline-board" role="list" aria-label="Project pipeline">
        {[...STAGES, ...(unknown.length ? [{ key: "unassigned", label: "Needs a phase" }] : [])].map((stage, index) => {
          const items = stage.key === "unassigned" ? unknown : projects.filter(p => p.status === stage.key);
          return (
            <section key={stage.key} id={`phase-${stage.key}`} className={`pipeline-phase${items.length ? " has-projects" : ""}`} role="listitem" aria-label={stage.label}>
              <div className="pipeline-phase-heading">
                <span className="pipeline-phase-number" aria-hidden="true">{index < 7 ? String(index + 1).padStart(2, "0") : "—"}</span>
                <div><h3>{stage.label}</h3><span>{items.length} project{items.length === 1 ? "" : "s"}</span></div>
              </div>
              <div className="pipeline-phase-projects">
                {items.length ? items.map(project => <ProjectDirectoryRow key={project.id} project={project} allowMove showClient />) : <p className="management-empty-phase">No projects in this phase.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
