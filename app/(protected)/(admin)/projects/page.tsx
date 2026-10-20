import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { PipelineBoard } from "@/components/projects/PipelineBoard";
import { ON_HOLD_STAGE, isForwardStage } from "@/lib/delivery";
import { createClient } from "@/lib/supabase/server";
import type { ProjectWithClient } from "@/lib/supabase/types";
import { createProject } from "./actions";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";

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

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; client?: string }>;
}) {
  const { error: formError, client: requestedClient } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_date, client_id, clients(name)")
    .order("updated_at", { ascending: false });
  const { data: rawClients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("status", "active")
    .order("name");
  const clients = (rawClients ?? []) as { id: string; name: string }[];

  const selectedClient = clients.find(c => c.id === requestedClient);

  const projects: ProjectWithClient[] = ((data ?? []) as ProjectRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    progress: p.progress,
    due_date: p.due_date,
    client_id: p.client_id,
    client_name: clientName(p.clients),
  }));

  const active = projects.filter((p) => isForwardStage(p.status)).length;
  const inReview = projects.filter((p) => p.status === "review").length;
  const inLaunch = projects.filter((p) => p.status === "launch").length;
  const onHold = projects.filter((p) => p.status === ON_HOLD_STAGE).length;

  return (
    <div className="content-wrap management-page management-pipeline">
      <header className="page-header management-heading">
        <div><p className="eyebrow electric">Project Pipeline</p><h2>Every project,<br /><em>in its place.</em></h2><p className="page-description">A clear view from Discovery to Care. Open the work, see what is due, and choose the next phase when it is ready.</p></div>
        <Link className="management-text-link" href="/clients">Client directory <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="metric-grid" aria-label="Pipeline metrics">
        <MetricCard label="Active Projects" value={error ? "—" : String(active)} detail={error ? "Data unavailable" : `${onHold} on hold`} tone="violet" />
        <MetricCard label="In Review" value={error ? "—" : String(inReview)} detail="Projects in review" tone="pink" />
        <MetricCard label="Launching" value={error ? "—" : String(inLaunch)} detail="Projects in launch" tone="cyan" />
      </section>
      {formError && <div className="management-notice" role="alert">{formError}</div>}
      {error && <div className="management-notice" role="alert"><strong>Project data could not load.</strong><span>Refresh to try again.</span></div>}

      <details className="nocturne-create-panel" id="new-project" open={Boolean(formError) || Boolean(requestedClient)} aria-label="New project">
        <summary className="nocturne-create-toggle"><strong>New project</strong><span>Make room for the next idea</span></summary>
        <form action={createProject} className="management-create-form">
          <fieldset className="management-create-fields" disabled={!!clientsError || !clients.length}>
          <label className="field"><span>Project name</span><input type="text" name="name" placeholder="Project name" required maxLength={160} /></label>
          <label className="field"><span>Client</span><select name="client_id" aria-label="Client" required defaultValue={selectedClient?.id ?? ""} disabled={!!clientsError}>
            <option value="" disabled>Choose a client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
          <label className="field"><span>Due date (optional)</span><input type="date" name="due_date" /></label>
          <PortalSubmitButton className="primary-button" pendingLabel="Creating…">Create project</PortalSubmitButton>
          </fieldset>
        </form>
        {clientsError ? <p className="management-notice" role="alert">Client choices could not load. Refresh before creating a project.</p> : !clients.length ? <p className="management-help">Create an active client in the <Link href="/clients">client directory</Link> first.</p> : requestedClient && !selectedClient ? <p className="management-help">Choose an active client for this new project.</p> : null}
      </details>
      {!error && <PipelineBoard projects={projects} />}
    </div>
  );
}
