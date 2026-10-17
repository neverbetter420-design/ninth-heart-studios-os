import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ClientProjectsPage() {
  const { profile } = await requireUser();
  if (profile.role !== "client") redirect("/");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_date")
    .order("updated_at", { ascending: false });
  const projects = data ?? [];

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 12 }}>
        <Link href="/portal" className="text-button">← Client overview</Link>
      </div>
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client workspace</p>
          <h2>My Projects</h2>
          <p className="page-description">Your active work, milestones, files, and conversations.</p>
        </div>
      </header>
      {error ? (
        <section className="panel empty-state" role="alert">
          <h3>Projects couldn't load.</h3><p>{error.message}</p>
        </section>
      ) : projects.length === 0 ? (
        <section className="panel empty-state">
          <h3>No projects assigned yet.</h3>
          <p>Contact the studio if you expected to see a project here.</p>
        </section>
      ) : (
        <section className="portal-project-grid" aria-label="Your projects">
          {projects.map((project) => (
            <article key={project.id} className="panel portal-project-card">
              <div className="portal-card-topline">
                <span className="beta-pill">{project.status}</span>
                <span>{project.progress}%</span>
              </div>
              <h3>{project.name}</h3>
              <div className="progress-track" aria-label={project.progress + "% complete"}>
                <span style={{ width: Math.min(100, Math.max(0, project.progress)) + "%" }} />
              </div>
              <p>{project.due_date ? "Target: " + project.due_date : "No target date set"}</p>
              <Link className="secondary-button inline-button" href={"/portal/projects/" + project.id}>
                Open project →
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
