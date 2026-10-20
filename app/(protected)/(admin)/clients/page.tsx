import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { createClient } from "@/lib/supabase/server";
import { createClient as createClientAction } from "./actions";
import { PortalSubmitButton } from "@/components/portal/PortalActionForm";

type ClientRow = {
  id: string;
  name: string;
  website: string | null;
  primary_email: string | null;
  status: string;
  created_at: string;
  client_memberships: { profile_id: string }[];
  projects: { id: string }[];
};

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error: formError } = await searchParams;
  const supabase = await createClient();
  const { data: rawClients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, website, primary_email, status, created_at, client_memberships(profile_id), projects(id)")
    .order("name");
  if (clientsError) throw new Error("Client management could not load.");
  const clients = (rawClients ?? []) as ClientRow[];
  const active = clients.filter(c => c.status === "active");
  return (
    <div className="content-wrap management-page management-clients">
      <header className="page-header management-heading">
        <div>
          <p className="eyebrow electric">Client Management</p>
          <h2>The people behind<br /><em>the projects.</em></h2>
          <p className="page-description">Your client relationships, their projects, and the people with portal access. A clear place for every connection.</p>
        </div>
        <Link className="management-text-link" href="/projects">Project Pipeline <span aria-hidden="true">↗</span></Link>
      </header>

      {formError && <div className="management-notice" role="alert">{formError}</div>}
      <section className="metric-grid" aria-label="Client metrics">
        <MetricCard label="Clients" value={String(clients.length)} detail={`${active.length} active`} tone="violet" />
        <MetricCard label="Portal members" value={String(clients.reduce((n, c) => n + c.client_memberships.length, 0))} detail="Client memberships" tone="cyan" />
        <MetricCard label="Client projects" value={String(clients.reduce((n, c) => n + c.projects.length, 0))} detail="Across all clients" tone="pink" />
      </section>

      <details className="nocturne-create-panel" open={Boolean(formError)} aria-label="New client">
        <summary className="nocturne-create-toggle"><strong>New client</strong><span>Start a new relationship</span></summary>
        <form action={createClientAction} className="management-create-form">
          <label className="field"><span>Client / business name</span><input type="text" name="name" placeholder="Business name" required maxLength={160} /></label>
          <label className="field"><span>Website (optional)</span><input type="text" name="website" placeholder="https://…" maxLength={280} /></label>
          <label className="field"><span>Primary email (optional)</span><input type="email" name="primary_email" placeholder="hello@business.com" maxLength={160} /></label>
          <PortalSubmitButton className="primary-button" pendingLabel="Creating…">Create client</PortalSubmitButton>
        </form>
      </details>

      <section className="management-directory" aria-labelledby="client-directory-title">
        <div className="management-section-heading"><div><p className="eyebrow">The studio circle</p><h3 id="client-directory-title">Client directory</h3></div><span>{clients.length} client{clients.length === 1 ? "" : "s"}</span></div>
        {clients.length === 0 ? <div className="management-empty"><h4>Your first connection starts here.</h4><p>Create a client above, or convert an existing lead.</p><Link className="management-text-link" href="/leads">Lead Intelligence ↗</Link></div> : (
          <ul className="management-client-list">
            {clients.map(c => <li key={c.id} className="management-client-row">
              <div className="management-client-copy"><h4>{c.name}</h4><p>{c.primary_email ?? "No primary email"}</p>{c.website && <small>{c.website}</small>}</div>
              <div className="management-client-stats"><span><strong>{c.projects.length}</strong> project{c.projects.length === 1 ? "" : "s"}</span><span><strong>{c.client_memberships.length}</strong> member{c.client_memberships.length === 1 ? "" : "s"}</span></div>
              <span className="management-client-status">{c.status === "active" ? "Active" : c.status === "archived" ? "Archived" : c.status}</span>
              <Link className="management-text-link" href={`/clients/${c.id}`} aria-label={`Open client: ${c.name}`}>Open client <span aria-hidden="true">↗</span></Link>
            </li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
