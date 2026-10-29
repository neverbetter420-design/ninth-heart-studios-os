import Link from "next/link";
import type { MuseProjectPlan } from "@/lib/muse-project-guide";
import {
  createMuseProjectDraft, renameMuseDraftTask, submitMuseProjectDraft,
  approveMuseProjectDraft, applyMuseProjectDraft, rejectMuseProjectDraft,
} from "@/app/(protected)/(admin)/muse/project-guide/actions";

type Project = { id: string; name: string; muse_revision: number };
type Draft = {
  id: string; project_id: string; status: string; plan_version: number;
  base_project_revision: number; plan: MuseProjectPlan; approved_hash: string | null;
};
type Review = { plan_version: number; plan_digest: string; plan: MuseProjectPlan };
type Work = { id: string; title: string; status: string; position: number | null; phase: string | null; blockedBy: string[]; subtaskCount: number; subtaskComplete: number; ready: boolean };
const eventLabels: Record<string,string> = {
  created: "Draft created. Review the complete roadmap before submitting.",
  edited: "Task updated. Your draft version has advanced.",
  submitted: "Draft submitted. Review the exact version and fingerprint before approval.",
  approved: "Plan approved. The project has NOT been modified yet.",
  applied: "Approved plan applied. Review the new internal project tasks below.",
  rejected: "Draft rejected. Existing project tasks were not changed.",
};
function stateLabel(state: string) {
  return ({draft:"Editable draft",pending_approval:"Awaiting review",approved:"Approved · not applied",applied:"Applied",rejected:"Rejected",conflicted:"Needs refresh"} as Record<string,string>)[state] ?? state.replaceAll("_"," ");
}

export function MuseProjectGuideConnected({
  projects, selected, draft, review, work, result, unavailable,
}: {
  projects: Project[];
  selected: Project | null;
  draft: Draft | null;
  review: Review | null;
  work: Work[];
  result: string;
  unavailable: boolean;
}) {
  const current = draft?.plan;
  const tasks = current?.phases.flatMap(p => p.tasks) ?? [];
  const stale = !!(selected && draft && selected.muse_revision !== draft.base_project_revision);
  const canDraft = !unavailable && !!selected;
  const canEdit = !!draft && draft.status === "draft" && !stale;
  const canSubmit = canEdit;
  const canApprove = !!draft && draft.status === "pending_approval" && !!review &&
    review.plan_version === draft.plan_version && !stale;
  const canApply = !!draft && draft.status === "approved" && !!draft.approved_hash && !stale;
  const readyWork = work.filter(t => t.ready && t.status !== "complete");
  const blocked = work.filter(t => !t.ready && t.status !== "complete");

  return (
    <section className="muse-guide muse-guide-connected" aria-label="Muse connected project planning">
      <div className="muse-guide-atmosphere" aria-hidden="true"/>
      <header className="muse-guide-hero">
        <div>
          <span className="muse-guide-kicker">Muse / Project Guide / Controlled workspace</span>
          <h1>From idea to <em>execution.</em></h1>
          <p>Review every step. Authorize every change. Keep the creative chaos on a short leash.</p>
        </div>
        <div className="muse-guide-monogram" aria-hidden="true"><span>✦</span></div>
      </header>
      <div className="muse-guide-ribbon" role="note">
        <span className="muse-guide-status-dot" aria-hidden="true"/>
        <strong>Admin-only · connected mode</strong>
        <span>All plans are internal by default. Project-plan approval never authorizes launch, email or scanning.</span>
      </div>

      <form method="get" action="/muse/project-guide" className="muse-connected-picker">
        <input type="hidden" name="mode" value="connected"/>
        <label htmlFor="muse-project-picker">Select project</label>
        <select id="muse-project-picker" name="project" defaultValue={selected?.id ?? ""} required>
          <option value="" disabled>Choose an NHS OS project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="muse-guide-secondary" type="submit">Open project</button>
        <Link className="management-text-link" href="/muse/project-guide">View sample guide</Link>
      </form>

      {result in eventLabels && <p className="muse-guide-feedback" role="status">{eventLabels[result]}</p>}
      {unavailable && <p className="muse-guide-blocked" role="alert">Connected planning is not ready in this environment. The proposed database schema must pass release review before use. No project changes were made.</p>}
      {!selected && <div className="muse-guide-view-heading"><h2>Choose a project to begin.</h2><p>The existing NHS OS project list is the source of truth. Muse does not create duplicate client projects.</p></div>}

      {selected && !unavailable && (
        <>
          <section className="muse-connected-project-heading">
            <div><span className="muse-guide-overline">SELECTED PROJECT</span><h2>{selected.name}</h2>
              <p>Project revision {selected.muse_revision} · Internal planning only</p></div>
            {draft && <span className="muse-guide-state">{stateLabel(draft.status)} · v{draft.plan_version}</span>}
          </section>
          {stale && <p className="muse-guide-blocked" role="alert">The project changed after this plan was generated. Approval and application are blocked. Start a fresh draft after reviewing existing work.</p>}
          {(!draft || ["applied","rejected","expired","conflicted"].includes(draft.status)) && (
            <section className="muse-connected-start">
              <div><span className="muse-guide-overline">NEW PLAN</span><h3>Start from the four-phase roadmap.</h3>
                <p>Muse will create a reviewable draft using the approved 21-task website redesign template. No live tasks are created yet.</p></div>
              <form action={createMuseProjectDraft}>
                <input type="hidden" name="project_id" value={selected.id}/>
                <button type="submit" className="muse-guide-primary" disabled={!canDraft}>Create draft plan</button>
              </form>
            </section>
          )}
          {draft && current && (
            <>
              <div className="muse-guide-stats" aria-label="Proposed project workload">
                <div><strong>{current.phases.length.toString().padStart(2,"0")}</strong><span>Phases</span></div>
                <div><strong>{tasks.length.toString().padStart(2,"0")}</strong><span>Tasks</span></div>
                <div><strong>{tasks.reduce((total,t) => total+t.subtasks.length,0)}</strong><span>Guided steps</span></div>
                <div><strong>v{draft.plan_version}</strong><span>Draft version</span></div>
              </div>
              <p className="muse-connected-summary">{current.summary}</p>
              <section aria-label="Proposed roadmap" className="muse-guide-roadmap">
                <div className="muse-guide-view-heading"><span className="muse-guide-overline">FULL CHANGE PREVIEW</span>
                  <h2>Review the entire plan.</h2><p>Open each phase to see all tasks, subtasks, and prerequisites.</p></div>
                <div className="muse-connected-phase-list">
                  {current.phases.map((phase,index) => (
                    <details key={phase.tempId} open={index===0} className="muse-connected-phase">
                      <summary><span className="muse-guide-phase-index">0{index+1}</span><strong>{phase.title}</strong>
                        <small>{phase.tasks.length} tasks</small><span className="muse-connected-plus" aria-hidden="true">+</span></summary>
                      <div className="muse-connected-task-list">
                        {phase.tasks.map(t => (
                          <article key={t.tempId} className="muse-connected-task">
                            <div><h3>{t.title}</h3><p>{t.description}</p>
                              {t.dependsOn.length>0 && <small>Requires {t.dependsOn.map(id => tasks.find(q=>q.tempId===id)?.title ?? id).join(", ")}</small>}</div>
                            <div><span className="muse-guide-overline">STEPS</span><ul>{t.subtasks.map(s => <li key={s.tempId}>{s.title}</li>)}</ul></div>
                            {canEdit && (
                              <details className="muse-connected-rename">
                                <summary>Rename this task</summary>
                                <form action={renameMuseDraftTask}>
                                  <input type="hidden" name="project_id" value={selected.id}/>
                                  <input type="hidden" name="draft_id" value={draft.id}/>
                                  <input type="hidden" name="expected_version" value={draft.plan_version}/>
                                  <input type="hidden" name="task_temp_id" value={t.tempId}/>
                                  <label>New title <input name="title" type="text" maxLength={160} minLength={2} required defaultValue={t.title}/></label>
                                  <button className="muse-guide-secondary" type="submit">Save draft edit</button>
                                </form>
                              </details>
                            )}
                          </article>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
              {current.warnings.length>0 && <div className="muse-connected-warnings" role="note">
                {current.warnings.map((w,i)=><p key={i}>{w}</p>)}
              </div>}
              {draft.status !== "applied" && draft.status !== "rejected" && (
                <section className="muse-connected-review">
                  <div>
                    <span className="muse-guide-overline">OWNER CONTROL</span>
                    <h2>{draft.status === "draft" ? "Ready for review?" : draft.status === "pending_approval" ? "Approve this exact version?" : "Apply the approved plan?"}</h2>
                    <p>Reviewing and approving never changes live tasks. Applying is a separate, explicit action.</p>
                  </div>
                  {canSubmit && <form action={submitMuseProjectDraft}>
                    <input type="hidden" name="project_id" value={selected.id}/>
                    <input type="hidden" name="draft_id" value={draft.id}/>
                    <input type="hidden" name="expected_version" value={draft.plan_version}/>
                    <button type="submit" className="muse-guide-primary">Submit v{draft.plan_version} for review</button>
                  </form>}
                  {canApprove && review && <form action={approveMuseProjectDraft} className="muse-connected-approval-form">
                    <p><strong>Plan version:</strong> {review.plan_version}</p>
                    <p className="muse-connected-digest"><strong>SHA-256 fingerprint:</strong> <code>{review.plan_digest}</code></p>
                    <input type="hidden" name="project_id" value={selected.id}/>
                    <input type="hidden" name="draft_id" value={draft.id}/>
                    <input type="hidden" name="expected_version" value={review.plan_version}/>
                    <input type="hidden" name="expected_hash" value={review.plan_digest}/>
                    <label className="muse-connected-confirm"><input type="checkbox" name="confirm_review" value="yes" required/>
                      I have reviewed this version and authorize the plan approval only.</label>
                    <button type="submit" className="muse-guide-primary">Approve plan v{draft.plan_version}</button>
                  </form>}
                  {canApply && <form action={applyMuseProjectDraft} className="muse-connected-approval-form">
                    <p><strong>Approved version:</strong> {draft.plan_version}</p>
                    <p className="muse-connected-digest"><strong>Approved fingerprint:</strong> <code>{draft.approved_hash}</code></p>
                    <p>{tasks.length} tasks and {current.phases.length} milestones will be created internally. No emails, scans, client approvals or launches.</p>
                    <input type="hidden" name="project_id" value={selected.id}/>
                    <input type="hidden" name="draft_id" value={draft.id}/>
                    <input type="hidden" name="expected_version" value={draft.plan_version}/>
                    <input type="hidden" name="expected_hash" value={draft.approved_hash ?? ""}/>
                    <label className="muse-connected-confirm"><input type="checkbox" name="confirm_apply" value="yes" required/>
                      I explicitly authorize creating these internal project records.</label>
                    <button type="submit" className="muse-guide-primary">Apply approved plan</button>
                  </form>}
                  {["draft","pending_approval","approved"].includes(draft.status) && <form action={rejectMuseProjectDraft}>
                    <input type="hidden" name="project_id" value={selected.id}/>
                    <input type="hidden" name="draft_id" value={draft.id}/>
                    <button type="submit" className="muse-guide-secondary">Reject this plan</button>
                  </form>}
                </section>
              )}
            </>
          )}
          {work.length>0 && (
            <section className="muse-connected-work" aria-label="Applied project guidance">
              <div className="muse-guide-view-heading"><span className="muse-guide-overline">LIVE PROJECT GUIDE · READ ONLY</span>
                <h2>What's ready next?</h2><p>These recommendations come from persisted NHS OS task states and prerequisites.</p></div>
              <div className="muse-guide-stats">
                <div><strong>{work.length}</strong><span>Internal tasks</span></div>
                <div><strong>{readyWork.length}</strong><span>Ready now</span></div>
                <div><strong>{blocked.length}</strong><span>Waiting</span></div>
                <div><strong>{work.filter(t => t.status==="complete").length}</strong><span>Complete</span></div>
              </div>
              <div className="muse-connected-work-list">
                {work.filter(t=>t.status!=="complete").slice(0,8).map(t => (
                  <article key={t.id} className="muse-connected-work-row">
                    <span className="muse-guide-state" data-state={t.ready?"ready":"blocked"}>{t.ready?"Ready":"Blocked"}</span>
                    <div><h3>{t.title}</h3><p>{t.phase ?? "Project task"} · {t.subtaskComplete}/{t.subtaskCount} guided steps
                      {t.blockedBy.length ? " · Waiting for "+t.blockedBy.join(", "):""}</p></div>
                  </article>
                ))}
              </div>
              <Link className="management-text-link" href={"/projects/"+selected.id}>Open project workspace ↗</Link>
            </section>
          )}
        </>
      )}
      <footer className="muse-guide-footer"><span>✦ NHS OS / MUSE PROJECT GUIDE</span>
        <span>Admin-controlled · launch and outreach permissions remain separate</span></footer>
    </section>
  );
}
