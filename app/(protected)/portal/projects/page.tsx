import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { stageLabel } from "@/lib/delivery";

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
    <div className="content-wrap atelier-collection-page">
      <Link href="/portal" className="atelier-text-link">← Your Atelier</Link>

      <header className="atelier-collection-heading">
        <p className="atelier-overline">Client Atelier · Project collection</p>
        <h2>Your projects, thoughtfully organized.</h2>
        <p>A clear place for timelines, shared work and everything the studio is making for you.</p>
      </header>

      {error ? (
        <section className="atelier-notice" role="alert">
          <h3>Projects couldn't load.</h3>
          <p>Refresh this page or contact the studio if the issue continues.</p>
        </section>
      ) : projects.length === 0 ? (
        <section className="atelier-empty">
          <span aria-hidden="true">◇</span>
          <h3>Nothing shared just yet.</h3>
          <p>Your projects will appear when the studio assigns them to your account.</p>
        </section>
      ) : (
        <section className="atelier-project-collection" aria-label="Your projects">
          <div className="atelier-collection-intro">
            <p className="atelier-overline">Your collection</p>
            <span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span>
          </div>
          {projects.map((project, index) => {
            const progress = Math.min(100, Math.max(0, Number(project.progress ?? 0)));
            return (
              <article key={project.id} className={"atelier-project-row" + (index === 0 ? " atelier-project-row-featured" : "")}>
                <div className="atelier-project-row-copy">
                  <div className="atelier-project-row-meta">
                    <span className="atelier-project-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="atelier-project-stage">{stageLabel(project.status)}</span>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.due_date
                    ? "Target " + new Date(project.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : "Timeline in progress"}</p>
                </div>
                <div className="atelier-project-row-progress">
                  <div className="atelier-progress-info"><span>Progress</span><strong>{progress}%</strong></div>
                  <div className="atelier-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={project.name + " progress"}>
                    <span style={{ width: progress + "%" }} />
                  </div>
                </div>
                <Link className="atelier-project-row-link" href={"/portal/projects/" + project.id}>
                  Open project <span aria-hidden="true">↗</span>
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
