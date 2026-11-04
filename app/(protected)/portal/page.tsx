import Link from "next/link";
import type { CSSProperties } from "react";
import { AtelierSymbol } from "@/components/AtelierSymbol";
import { AtelierRelic } from "@/components/AtelierRelic";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { ClientProject } from "@/lib/supabase/types";
import { AtelierCompass } from "@/components/portal/AtelierCompass";
import { stageLabel } from "@/lib/delivery";

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
    <div className="content-wrap atelier-home nhs-color-studio">
      <section className="atelier-hero nhs-color-hero" aria-labelledby="atelier-greeting">
        <div className="atelier-hero-copy">
          <p className="atelier-overline nhs-color-eyebrow"><AtelierSymbol name="rose" size={17} /> Ninth Heart Studios · Private client atelier</p>
          <h2 id="atelier-greeting">Welcome back, <em>{firstName}.</em></h2>
          <p>A space for the beautiful things we're making together.<br />Every milestone, message, and next step, in one place.</p>
          {featured && !error ? (
            <Link className="atelier-welcome-cta" href={nextApproval ? "/portal/approvals" : "/portal/projects/" + featured.id}>
              {nextApproval ? "Review your next decision" : "Enter your project"} <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <Link className="atelier-welcome-cta" href="/portal/projects">Explore my projects <span aria-hidden="true">↗</span></Link>
          )}
          {!error && <div className="nhs-portal-glance" aria-label="Your studio at a glance">
            <span><AtelierSymbol name="key" size={17}/><strong>{visibleProjects.length}</strong> {visibleProjects.length === 1 ? "project" : "projects"}</span>
            <span><AtelierSymbol name="spark" size={17}/><strong>{approvalError ? "—" : pendingApprovals.length}</strong> {approvalError ? "decisions unavailable" : "pending decisions"}</span>
          </div>}
        </div>
        <div className="nhs-color-hero-art" aria-hidden="true">
          <span className="nhs-color-hero-ring nhs-color-hero-ring--outer"/>
          <span className="nhs-color-hero-ring nhs-color-hero-ring--inner"/>
          <span className="nhs-color-hero-core"><img src="/brand/nhs-original-logo.webp" alt="" width={118} height={118}/><small>YOUR CREATIVE WORLD</small></span>
          <span className="nhs-color-amulet nhs-color-amulet--rose nhs-hero-relic" data-relic="rose"><AtelierRelic name="rose" size={133}/></span>
          <span className="nhs-color-amulet nhs-color-amulet--skull nhs-hero-relic" data-relic="skull"><AtelierRelic name="skull" size={113}/></span>
          <span className="nhs-color-amulet nhs-color-amulet--key nhs-hero-relic" data-relic="key"><AtelierRelic name="key" size={128}/></span>
        </div>
      </section>
      <div className="nhs-relic-divider nhs-relic-divider--arrival" aria-hidden="true">
        <span/><AtelierRelic name="rose" size={36}/><AtelierRelic name="key" size={31}/><span/>
      </div>

      {error ? (
        <section className="atelier-notice" role="alert">
          <h3>Projects are temporarily unavailable.</h3>
          <p>We couldn't load your projects. Refresh or contact the studio if this keeps happening.</p>
        </section>
      ) : visibleProjects.length === 0 ? (
        <section className="atelier-empty nhs-relic-empty" aria-labelledby="atelier-empty-heading">
          <div className="nhs-relic-empty-art" aria-hidden="true"><AtelierRelic name="rose" size={86}/><AtelierRelic name="key" size={70}/></div>
          <h3 id="atelier-empty-heading">Your story begins here.</h3>
          <p>Your account is ready. Your projects will appear as soon as the studio shares them with you.</p>
        </section>
      ) : (
        <div className="atelier-home-body">
          <div className="atelier-feature-column">
            <div className="atelier-section-heading">
              <p className="atelier-overline nhs-color-eyebrow"><AtelierSymbol name="key" size={17}/> Your project</p>
              <Link href="/portal/projects">See all projects <span aria-hidden="true">→</span></Link>
            </div>
            <article className="atelier-feature-project">
              <div className="atelier-project-topline">
                <span className="atelier-project-tag">Current project</span>
                <span className="atelier-project-stage">{stageLabel(featured.status)}</span>
              </div>
              <div className="nhs-feature-project-layout">
                <div className="nhs-feature-project-copy">
                  <h3>{featured.name}</h3>
                  <p>Designed with intention. Built for what's next.</p>
                  <div className="atelier-progress-info">
                    <span>Project progress</span><strong>{progress}%</strong>
                  </div>
                  <div className="atelier-progress-track" role="progressbar" aria-label="Project progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <div className="nhs-portal-progress-dial" style={{ "--nhs-progress": `${progress}%` } as CSSProperties} aria-hidden="true">
                  <span className="nhs-portal-progress-dial__center"><strong>{progress}%</strong><small>IN MOTION</small></span>
                  <span className="nhs-dial-relic nhs-dial-relic--rose"><AtelierRelic name="rose" size={53}/></span>
                  <span className="nhs-dial-relic nhs-dial-relic--key"><AtelierRelic name="key" size={44}/></span>
                </div>
              </div>
              <div className="atelier-project-footer">
                <span>{featured.due_date ? `Target ${featured.due_date}` : "Timeline in progress"}</span>
                <Link className="atelier-primary-link" href={`/portal/projects/${featured.id}`}>Open workspace <span aria-hidden="true">↗</span></Link>
              </div>
            </article>
          </div>

          <AtelierCompass
            projectId={featured.id}
            projectName={featured.name}
            stage={stageLabel(featured.status)}
            progress={progress}
            nextApprovalTitle={nextApproval?.title ?? null}
            pendingApprovals={pendingApprovals.length}
            approvalsUnavailable={Boolean(approvalError)}
          />
        </div>
      )}

      <div className="nhs-relic-divider nhs-relic-divider--essentials" aria-hidden="true">
        <span/><AtelierRelic name="skull" size={39}/><AtelierRelic name="rose" size={37}/><AtelierRelic name="key" size={35}/><span/>
      </div>
      <section className="atelier-destinations" aria-label="Quick links">
        <div className="atelier-section-heading">
          <div>
            <p className="atelier-overline nhs-color-eyebrow"><AtelierSymbol name="rose" size={17}/> Made simple</p>
            <h3>Your studio essentials.</h3>
          </div>
        </div>
        <div className="atelier-destination-grid">
          <Link href="/portal/messages" className="atelier-destination">
            <span className="atelier-destination-icon" aria-hidden="true"><PortalIcon name="messages" size={28}/></span>
            <strong>Messages</strong>
            <small>Talk to your designer</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link href="/portal/files" className="atelier-destination">
            <span className="atelier-destination-icon" aria-hidden="true"><PortalIcon name="files" size={28}/></span>
            <strong>Project files</strong>
            <small>Find and share files</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link href="/portal/documents" className="atelier-destination">
            <span className="atelier-destination-icon" aria-hidden="true"><PortalIcon name="documents" size={28}/></span>
            <strong>Documents</strong>
            <small>Agreements, forms & paperwork</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link href="/portal/approvals" className="atelier-destination nhs-color-destination--approvals">
            <span className="atelier-destination-icon" aria-hidden="true"><PortalIcon name="approvals" size={28}/></span>
            <strong>Approvals</strong>
            <small>{approvalError ? "Review your decisions" : pendingApprovals.length ? `${pendingApprovals.length} awaiting your review` : "All decisions in one place"}</small>
            <span className="atelier-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
