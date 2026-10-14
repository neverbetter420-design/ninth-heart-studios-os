import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addClientMember, removeClientMember } from "../actions";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: formError } = await searchParams;
  const supabase = await createClient();

  const { data: rawClient } = await supabase
    .from("clients")
    .select("id, name, website, primary_email, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!rawClient) notFound();
  const client = rawClient as {
    id: string;
    name: string;
    website: string | null;
    primary_email: string | null;
    status: string;
    created_at: string;
  };

  const [{ data: rawMembers }, { data: rawProjects }] = await Promise.all([
    supabase
      .from("client_memberships")
      .select("client_id, profile_id, member_role, created_at, profiles(id, full_name, email, role)")
      .eq("client_id", id)
      .order("created_at"),
    supabase
      .from("projects")
      .select("id, name, status, progress, due_date")
      .eq("client_id", id)
      .order("updated_at", { ascending: false }),
  ]);

  const members = (rawMembers ?? []) as {
    profile_id: string;
    member_role: string;
    profiles: { full_name: string | null; email: string | null; role: string } | { full_name: string | null; email: string | null; role: string }[] | null;
  }[];
  type MemberRow = {
    profile_id: string;
    member_role: string;
    profile: { full_name: string | null; email: string | null; role: string } | null;
  };
  const memberProfiles: MemberRow[] = members.map((m) => ({
    profile_id: m.profile_id,
    member_role: m.member_role,
    profile: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
  }));
  const projects = (rawProjects ?? []) as { id: string; name: string; status: string; progress: number; due_date: string | null }[];

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/clients" className="text-button">← Clients</Link>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client · {client.status}</p>
          <h2>{client.name}</h2>
          <p className="page-description">
            {client.primary_email ?? "No email"}
            {client.website ? ` · ${client.website}` : ""}
          </p>
        </div>
      </header>

      {formError ? (
        <section className="panel lead-query-error" style={{ marginBottom: 14 }}>
          <strong>Heads up.</strong>
          <span>{decodeURIComponent(formError)}</span>
        </section>
      ) : null}

      <section className="panel" aria-label="Portal members" style={{ marginBottom: 14 }}>
        <div className="panel-heading">
          <h3>Portal members</h3>
          <span className="pipeline-count">{members.length}</span>
        </div>
        <ul className="delivery-list">
          {members.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No portal members yet. Add someone by their account email below.</p>
            </li>
          ) : (
            memberProfiles.map((m) => (
              <li key={m.profile_id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">{m.profile?.full_name ?? m.profile?.email ?? "Unknown"}</p>
                  <p className="delivery-row-sub">
                    {m.profile?.email ?? ""} · {m.member_role} · {m.profile?.role ?? ""}
                  </p>
                </div>
                <form action={removeClientMember}>
                  <input type="hidden" name="client_id" value={client.id} />
                  <input type="hidden" name="profile_id" value={m.profile_id} />
                  <button type="submit" className="mini-button danger">Remove</button>
                </form>
              </li>
            ))
          )}
        </ul>
        <form action={addClientMember} className="delivery-add-form">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="email" name="email" placeholder="Member's account email…" required maxLength={160} />
          <button type="submit" className="mini-button go">Add member</button>
        </form>
        <p className="muted-copy" style={{ fontSize: 12, padding: "0 18px 14px" }}>
          Members get portal access to this client&apos;s projects. They need a signed-up account first.
        </p>
      </section>

      <section className="panel" aria-label="Projects">
        <div className="panel-heading">
          <h3>Projects</h3>
          <span className="pipeline-count">{projects.length}</span>
        </div>
        <ul className="delivery-list">
          {projects.length === 0 ? (
            <li className="delivery-row">
              <p className="pipeline-empty">No projects yet.</p>
            </li>
          ) : (
            projects.map((p) => (
              <li key={p.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">
                    <Link href={`/projects/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {p.name}
                    </Link>
                  </p>
                  <p className="delivery-row-sub">
                    {p.status} · {p.progress}% complete
                    {p.due_date ? ` · Due ${new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
