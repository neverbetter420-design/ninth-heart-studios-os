import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ClientProject } from "@/lib/supabase/types";

export default async function ClientPortalPage() {
  const { profile } = await requireUser();
  if (profile.role !== "client") redirect("/");
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_date, client_id")
    .order("updated_at", { ascending: false });

  const visibleProjects = (projects ?? []) as ClientProject[];

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client Portal</p>
          <h2>Your project, without the backstage chaos.</h2>
          <p className="page-description">
            Welcome back, {profile.full_name ?? profile.email ?? "NHS Client"}. Everything you need for your projects is here.
          </p>
        </div>
      </header>

      <section className="portal-shortcuts" aria-label="Client workspace shortcuts">
        {[
          { href: "/portal/projects", label: "My Projects" },
          { href: "/portal/messages", label: "Messages" },
          { href: "/portal/files", label: "Files" },
          { href: "/portal/approvals", label: "Approvals" },
          { href: "/portal/contracts", label: "Contracts" },
          { href: "/portal/forms", label: "Forms" },
        ].map((item) => (
          <Link className="portal-shortcut" href={item.href} key={item.href}>
            <strong>{item.label}</strong><span aria-hidden="true">→</span>
          </Link>
        ))}
      </section>

      <section className="panel security-banner">
        <span className="status-dot" />
        <div>
          <strong>Client isolation active</strong>
          <p>Project records, visible tasks, approvals, and private files are filtered in Supabase, not just hidden in the interface.</p>
        </div>
      </section>

      {error ? (
        <section className="panel empty-state">
          <h3>Supabase is not connected yet.</h3>
          <p>{error.message}</p>
        </section>
      ) : visibleProjects.length === 0 ? (
        <section className="panel empty-state">
          <h3>No projects assigned yet.</h3>
          <p>Your account is working, but it is not linked to a client project yet.</p>
        </section>
      ) : (
        <section id="projects" className="portal-project-grid" aria-label="Your projects">
          {visibleProjects.map((project) => (
            <article className="panel portal-project-card" key={project.id}>
              <div className="portal-card-topline">
                <span className="beta-pill">{project.status}</span>
                <span>{project.progress}%</span>
              </div>
              <h3>{project.name}</h3>
              <div className="progress-track" aria-label={`${project.progress}% complete`}>
                <span style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} />
              </div>
              <p>{project.due_date ? `Target: ${project.due_date}` : "No target date set"}</p>
              <Link className="secondary-button inline-button" href={`/portal/projects/${project.id}`}>
                Open project →
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
