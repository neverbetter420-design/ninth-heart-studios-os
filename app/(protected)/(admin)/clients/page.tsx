import Link from "next/link";
import { MetricCard } from "@/components/MetricCard";
import { createClient } from "@/lib/supabase/server";
import { createClient as createClientAction, setClientStatusWithFeedback } from "./actions";
import { PortalActionForm, PortalSubmitButton } from "@/components/portal/PortalActionForm";

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

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: formError } = await searchParams;
  const supabase = await createClient();

  const { data: rawClients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, website, primary_email, status, created_at, client_memberships(profile_id), projects(id)")
    .order("name");
  if (clientsError) throw new Error("Client management could not load.");
  const clients = (rawClients ?? []) as ClientRow[];

  const active = clients.filter((c) => c.status === "active");

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client Management</p>
          <h2>The people behind the projects.</h2>
          <p className="page-description">
            Every client record, their members with portal access, and their
            projects — in one place.
          </p>
        </div>
      </header>

      {formError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(formError)}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Client metrics">
        <MetricCard label="Clients" value={String(clients.length)} detail={`${active.length} active`} tone="violet" />
        <MetricCard
          label="Portal members"
          value={String(clients.reduce((n, c) => n + c.client_memberships.length, 0))}
          detail="Users linked to clients"
          tone="cyan"
        />
        <MetricCard
          label="Client projects"
          value={String(clients.reduce((n, c) => n + c.projects.length, 0))}
          detail="Across all clients"
          tone="pink"
        />
      </section>

      <section className="panel" aria-label="New client" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>New client</h3>
        </div>
        <form action={createClientAction} className="delivery-add-form">
          <input type="text" name="name" placeholder="Client / business name…" required maxLength={160} />
          <input type="text" name="website" placeholder="Website (optional)" maxLength={280} />
          <input type="email" name="primary_email" placeholder="Primary email (optional)" maxLength={160} />
          <PortalSubmitButton pendingLabel="Creating…">Create</PortalSubmitButton>
        </form>
      </section>

      <section className="panel" aria-label="Clients">
        <div className="panel-heading">
          <h3>Clients</h3>
        </div>
        <ul className="delivery-list">
          {clients.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No clients yet. Create the first one above — or convert a lead.</p>
            </li>
          ) : (
            clients.map((c) => (
              <li key={c.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">
                    <Link href={`/clients/${c.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {c.name}
                    </Link>
                  </p>
                  <p className="delivery-row-sub">
                    {c.primary_email ?? "No email"}
                    {c.website ? ` · ${c.website}` : ""} · {c.projects.length} project{c.projects.length === 1 ? "" : "s"} ·{" "}
                    {c.client_memberships.length} member{c.client_memberships.length === 1 ? "" : "s"}
                  </p>
                </div>
                <PortalActionForm action={setClientStatusWithFeedback} pendingMessage="Updating client…" lockOnSuccess={false}>
                  <input type="hidden" name="client_id" value={c.id} />
                  <input type="hidden" name="status" value={c.status === "active" ? "archived" : "active"} />
                  <button type="submit" className="mini-button">
                    {c.status === "active" ? "Archive" : "Restore"}
                  </button>
                </PortalActionForm>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
