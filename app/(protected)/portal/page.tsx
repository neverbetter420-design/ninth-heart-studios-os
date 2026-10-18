import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ClientProject } from "@/lib/supabase/types";

type PendingClientApproval = {
  id: string;
  title: string;
  project_id: string;
};

export default async function ClientPortalPage() {
  const { profile } = await requireUser();
  if (profile.role !== "client") redirect("/");

  const supabase = await createClient();
  const [{ data: projects, error }, { data: approvals, error: approvalError }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, progress, due_date, client_id")
      .order("updated_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id, title, project_id")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(3),
  ]);

  const visibleProjects = (projects ?? []) as ClientProject[];
  const pendingApprovals = (approvals ?? []) as PendingClientApproval[];
  const featured = visibleProjects[0];
  const progress = Math.min(100, Math.max(0, Number(featured?.progress ?? 0)));
  const firstName = profile.full_name?.trim().split(/\s+/)[0] || "there";
  const nextApproval = pendingApprovals[0];

  return (
    <div className="content-wrap atelier-home">
      <section className="atelier-hero" aria-labelledby="atelier-greeting">
        <div className="atelier-hero-copy">
          <p className="atelier-overline">Ninth Heart Studios · Your private Atelier</p>
          <h2 id="atelier-greeting">Welcome back, {firstName}.</h2>
          <p>Your website is taking shape. Find the important updates, decisions, and files without the backstage noise.</p>
          <Link className="atelier-primary-link" href={featured ? `/portal/projects/${featured.id}` : "/portal/projects"}>
            {featured ? "View my project" : "Explore my projects"} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <span className="atelier-hero-emblem" aria-hidden="true">✧</span>
      </section>

      {error ? (
        <section className="atelier-notice" role="alert">
          <h3>Projects are temporarily unavailable.</h3>
          <p>We couldn't load your projects. Refresh or contact the studio if this keeps happening.</p>
        </section>
      ) : visibleProjects.length === 0 ? (
        <section className="atelier-empty" aria-labelledby="atelier-empty-heading">
          <span aria-hidden="true">◇</span>
          <h3 id="atelier-empty-heading">Your story begins here.</h3>
          <p>Your account is ready. Your projects will appear as soon as the studio shares them with you.</p>
        </section>
      ) : (
        <div className="atelier-home-body">
          <div className="atelier-feature-column">
            <div className="atelier-section-heading">
              <p className="atelier-overline">Your project</p>
              <Link href="/portal/projects">See all projects <span aria-hidden="true">→</span></Link>
            </div>
            <article className="atelier-feature-project">
              <div className="atelier-project-topline">
                <span className="atelier-project-tag">Current project</span>
                <span className="atelier-project-stage">{featured.status.replace(/_/g, " ")}</span>
              </div>
              <h3>{featured.name}</h3>
              <p>Designed with intention. Built for what's next.</p>
              <div className="atelier-progress-info">
                <span>Project progress</span><strong>{progress}%</strong>
              </div>
              <div className="atelier-progress-track" role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="atelier-project-footer">
                <span>{featured.due_date ? `Target ${featured.due_date}` : "Timeline in progress"}</span>
                <Link href={`/portal/projects/${featured.id}`}>Open workspace <span aria-hidden="true">↗</span></Link>
              </div>
            </article>
          </div>

          <aside className="atelier-action-panel" aria-labelledby="atelier-action-heading">
            <p className="atelier-overline">Your next step</p>
            <h3 id="atelier-action-heading">{nextApproval ? "A decision awaits you" : approvalError ? "Your workspace is ready" : "Stay in the loop"}</h3>
            <p>{nextApproval ? nextApproval.title : approvalError ? "Visit your project for the latest updates and requests." : "Everything important stays in your project workspace. Check the latest progress anytime."}</p>
            <Link href={nextApproval ? "/portal/approvals" : `/portal/projects/${featured.id}`} className="atelier-text-link">
              {nextApproval ? "Review approval" : "View project updates"} <span aria-hidden="true">→</span>
            </Link>
            {pendingApprovals.length > 1 ? <span className="atelier-action-note">{pendingApprovals.length} approvals need review</span> : null}
          </aside>
        </div>
      )}

      <section className="atelier-destinations" aria-label="Quick links">
        <div className="atelier-section-heading">
          <div>
            <p className="atelier-overline">Made simple</p>
            <h3>Everything in its place.</h3>
          </div>
        </div>
        <div className="atelier-destination-grid">
          <Link href="/portal/messages" className="atelier-destination">
            <span className="atelier-destination-icon" aria-hidden="true">✉</span>
            <strong>Messages</strong>
            <small>Talk to your designer</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link href="/portal/files" className="atelier-destination">
            <span className="atelier-destination-icon" aria-hidden="true">▤</span>
            <strong>Project files</strong>
            <small>Find and share files</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link href="/portal/documents" className="atelier-destination">
            <span className="atelier-destination-icon" aria-hidden="true">✧</span>
            <strong>Documents</strong>
            <small>Agreements, forms & paperwork</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
