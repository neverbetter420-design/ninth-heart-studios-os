import Link from "next/link";
import { ProjectDirectoryRow } from "@/components/projects/ProjectDirectoryRow";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { addClientMemberWithFeedback, removeClientMemberWithFeedback, setClientStatusWithFeedback } from "../actions";
import { PortalActionForm, PortalSubmitButton } from "@/components/portal/PortalActionForm";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
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

  const [{ data: rawMembers, error: membersError }, { data: rawProjects, error: projectsError }] = await Promise.all([
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

  let websiteHref: string | null = null;
  if (client.website) {
    try {
      const url = new URL(/^https?:\/\//i.test(client.website) ? client.website : `https://${client.website}`);
      if (["http:", "https:"].includes(url.protocol) && url.hostname.includes(".") && !url.username && !url.password) websiteHref = url.toString();
    } catch { /* Preserve the contact text when a link is invalid. */ }
  }

  return (
    <div className="content-wrap management-page management-client-workspace">
      <Link className="management-back-link" href="/clients">← Client directory</Link>
      <header className="page-header management-heading">
        <div><p className="eyebrow electric">Client · {client.status}</p><h2>{client.name}</h2><p className="page-description">The projects, people and details behind this relationship.</p></div>
        {client.status === "active" && <Link className="management-primary-link" href={`/projects?client=${client.id}#new-project`}>New project <span aria-hidden="true">↗</span></Link>}
      </header>
      {formError && <div className="management-notice" role="alert">{formError}</div>}
      <nav className="management-destinations" aria-label="Client workspace destinations"><a href="#client-projects">Projects</a><a href="#client-access">Portal access</a><a href="#client-contact">Contact details</a><a href="#client-status">Client status</a></nav>

      <div className="management-client-grid">
        <div className="management-client-work">
          <section id="client-projects" aria-labelledby="client-projects-title">
            <div className="management-section-heading"><div><p className="eyebrow">In the studio</p><h3 id="client-projects-title">Client projects</h3></div><span>{projectsError ? "Unavailable" : `${projects.length} projects`}</span></div>
            {projectsError ? <p className="management-notice" role="alert">Projects could not load. Refresh to try again.</p> : projects.length ? projects.map(p => <ProjectDirectoryRow key={p.id} project={{ ...p, client_id: client.id, client_name: client.name }} />) : <p className="management-empty-copy">No projects yet. Start one when this client is ready.</p>}
          </section>

          <section id="client-access" aria-labelledby="client-access-title">
            <div className="management-section-heading"><div><p className="eyebrow">People &amp; permissions</p><h3 id="client-access-title">Portal members</h3></div><span>{membersError ? "Unavailable" : `${members.length} linked`}</span></div>
            {membersError ? <p className="management-notice" role="alert">Could not load portal members. Refresh this page before changing access.</p> : !members.length ? <p className="management-empty-copy">No portal members yet. Add an existing account below.</p> : (
              <ul className="management-member-list">
                {memberProfiles.map(m => <li className="management-member-row" key={m.profile_id}>
                  <div><strong>{m.profile?.full_name ?? m.profile?.email ?? "Unknown member"}</strong><p>{m.profile?.email ?? "Email unavailable"}</p><small>{m.member_role === "client" ? "Client access" : m.member_role} · {m.profile?.role === "admin" ? "Admin account" : m.profile?.role === "client" ? "Client account" : "Account role unavailable"}</small></div>
                  <PortalActionForm action={removeClientMemberWithFeedback} pendingMessage="Removing member access…" confirmMessage={`Remove ${m.profile?.full_name ?? m.profile?.email ?? "this member"} from ${client.name}? This removes their membership-based portal access to this client's projects. Their account and other client memberships are kept.`}>
                    <input type="hidden" name="client_id" value={client.id} /><input type="hidden" name="profile_id" value={m.profile_id} />
                    <PortalSubmitButton pendingLabel="Removing…" className="mini-button danger">Remove</PortalSubmitButton>
                  </PortalActionForm>
                </li>)}
              </ul>
            )}
            <PortalActionForm action={addClientMemberWithFeedback} className="management-member-add" pendingMessage="Adding member access…" lockOnSuccess={false} resetOnSuccess>
              <input type="hidden" name="client_id" value={client.id} />
              <label className="field"><span>Member&apos;s account email</span><input type="email" name="email" aria-label="Member's account email" placeholder="name@business.com" required maxLength={160} disabled={!!membersError} /></label>
              <button type="submit" className="mini-button go" disabled={!!membersError}>Add member</button>
            </PortalActionForm>
            <p className="management-help">Members get portal access to this client&apos;s projects. They need a signed-up account first.</p>
          </section>
        </div>

        <aside className="management-client-context">
          <section id="client-contact" aria-labelledby="client-contact-title"><div className="management-section-heading"><div><p className="eyebrow">The connection</p><h3 id="client-contact-title">Contact details</h3></div></div>
            <dl className="management-contact-list"><div><dt>Email</dt><dd>{client.primary_email ?? "No primary email"}</dd></div><div><dt>Website</dt><dd>{websiteHref ? <a href={websiteHref} target="_blank" rel="noreferrer">Open website ↗</a> : client.website ?? "Not added"}</dd></div></dl>
          </section>
          <section id="client-status" aria-label="Client status"><div className="management-section-heading"><div><p className="eyebrow">Relationship</p><h3>Client status</h3></div></div><p className="management-status-copy">{client.status === "active" ? "Active client" : client.status === "archived" ? "Archived client" : client.status}</p>
            <PortalActionForm action={setClientStatusWithFeedback} pendingMessage="Updating client…" lockOnSuccess={false}>
              <input type="hidden" name="client_id" value={client.id} /><input type="hidden" name="status" value={client.status === "active" ? "archived" : "active"} />
              <button type="submit" className="mini-button">{client.status === "active" ? "Archive client" : "Restore client"}</button>
            </PortalActionForm>
            <p className="management-help">Archiving keeps the client record and existing memberships. Manage portal access in the member list.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
