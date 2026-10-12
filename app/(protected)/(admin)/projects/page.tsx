import { MetricCard } from "@/components/MetricCard";
import { PipelineBoard } from "@/components/projects/PipelineBoard";
import { ON_HOLD_STAGE } from "@/lib/delivery";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithClient } from "@/lib/supabase/types";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progress: number;
  due_date: string | null;
  client_id: string;
  clients: { name: string | null } | { name: string | null }[] | null;
};

function clientName(rel: ProjectRow["clients"]): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_date, client_id, clients(name)")
    .order("updated_at", { ascending: false });

  const projects: ProjectWithClient[] = ((data ?? []) as ProjectRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    progress: p.progress,
    due_date: p.due_date,
    client_id: p.client_id,
    client_name: clientName(p.clients),
  }));

  const active = projects.filter((p) => p.status !== ON_HOLD_STAGE).length;
  const inReview = projects.filter((p) => p.status === "review").length;
  const inLaunch = projects.filter((p) => p.status === "launch").length;
  const onHold = projects.filter((p) => p.status === ON_HOLD_STAGE).length;

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Project Pipeline</p>
          <h2>Delivery without the scavenger hunt.</h2>
          <p className="page-description">
            Every build, from discovery to care plan, in one view. Move a card,
            open the workspace, keep the machine fed.
          </p>
        </div>
      </header>

      <section className="metric-grid" aria-label="Pipeline metrics">
        <MetricCard label="Active Projects" value={String(active)} detail="Across all stages" tone="violet" />
        <MetricCard label="In Review" value={String(inReview)} detail="Waiting on approvals" tone="pink" />
        <MetricCard label="Launching" value={String(inLaunch)} detail="Almost out the door" tone="cyan" />
        <MetricCard label="On Hold" value={String(onHold)} detail="Parked, not dead" tone="green" />
      </section>

      {error ? (
        <section className="panel lead-query-error">
          <strong>Project data could not load.</strong>
          <span>{error.message}</span>
        </section>
      ) : null}

      <PipelineBoard projects={projects} />
    </div>
  );
}
