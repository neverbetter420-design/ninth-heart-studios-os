import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { milestoneStatusLabel, stageLabel } from "@/lib/delivery";
import { decideApproval } from "./actions";

type ApprovalRow = {
  id: string;
  title: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
  client_comment: string | null;
};

export default async function ClientProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireUser();
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, progress, due_date")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: tasks },
    { data: approvals },
    { data: files },
    { data: milestones },
    { data: followups },
    { data: updates },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("approvals")
      .select("id, title, status, requested_at, decided_at, client_comment")
      .eq("project_id", projectId)
      .order("requested_at", { ascending: false }),
    supabase
      .from("files")
      .select("id, filename, visibility, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("milestones")
      .select("id, title, status, due_date")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase
      .from("launch_items")
      .select("id, label, due_at, done")
      .eq("project_id", projectId)
      .eq("kind", "followup")
      .order("due_at", { ascending: true }),
    supabase
      .from("activities")
      .select("id, summary, created_at")
      .eq("project_id", projectId)
      .eq("client_visible", true)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pendingApprovals = ((approvals ?? []) as ApprovalRow[]).filter((a) => a.status === "pending");
  const decidedApprovals = ((approvals ?? []) as ApprovalRow[]).filter((a) => a.status !== "pending");

  return (
    <div className="content-wrap">
      <div className="lead-detail-backline" style={{ marginBottom: 10 }}>
        <Link href="/portal" className="text-button">← Client Portal</Link>
      </div>
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client Project</p>
          <h2>{project.name}</h2>
          <p className="page-description">
            <span className="stage-badge">{stageLabel(project.status)}</span>{" "}
            {project.progress}% complete
            {project.due_date
              ? ` · Target ${new Date(project.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
              : ""}
          </p>
        </div>
      </header>

      {pendingApprovals.length > 0 ? (
        <section className="panel" aria-label="Approvals needing your decision" style={{ marginBottom: 14 }}>
          <div className="panel-heading">
            <h3>Needs your sign-off</h3>
            <span className="pipeline-count">{pendingApprovals.length}</span>
          </div>
          <ul className="delivery-list">
            {pendingApprovals.map((approval) => (
              <li key={approval.id} className="delivery-row">
                <div className="delivery-row-main">
                  <p className="delivery-row-title">{approval.title}</p>
                  <p className="delivery-row-sub">
                    Requested {new Date(approval.requested_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <form action={decideApproval} className="delivery-add-form" style={{ borderTop: 0, padding: 0 }}>
                  <input type="hidden" name="approval_id" value={approval.id} />
                  <input type="text" name="client_comment" placeholder="Comment (optional)…" maxLength={280} />
                  <button type="submit" name="decision" value="approved" className="mini-button go">
                    Approve
                  </button>
                  <button type="submit" name="decision" value="declined" className="mini-button danger">
                    Request changes
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="client-detail-grid">
        <article className="panel detail-panel">
          <h3>Milestones</h3>
          {(milestones ?? []).length ? (milestones ?? []).map((m) => (
            <div className="simple-row" key={m.id}>
              <strong>{m.title}</strong>
              <span>{milestoneStatusLabel(m.status)}</span>
            </div>
          )) : <p className="muted-copy">No milestones shared yet.</p>}
        </article>

        <article className="panel detail-panel">
          <h3>Visible tasks</h3>
          {(tasks ?? []).length ? (tasks ?? []).map((task) => (
            <div className="simple-row" key={task.id}>
              <strong>{task.title}</strong>
              <span>{task.status}</span>
            </div>
          )) : <p className="muted-copy">No client-visible tasks yet.</p>}
        </article>

        <article className="panel detail-panel">
          <h3>Past decisions</h3>
          {decidedApprovals.length ? decidedApprovals.map((approval) => (
            <div className="simple-row" key={approval.id}>
              <strong>{approval.title}</strong>
              <span>{approval.status === "approved" ? "Approved" : "Changes requested"}</span>
            </div>
          )) : <p className="muted-copy">No decisions recorded yet.</p>}
        </article>

        <article className="panel detail-panel">
          <h3>Follow-ups</h3>
          {(followups ?? []).length ? (followups ?? []).map((f) => (
            <div className="simple-row" key={f.id}>
              <strong style={f.done ? { textDecoration: "line-through", opacity: 0.55 } : undefined}>
                {f.label}
              </strong>
              <span>{f.done ? "Done" : f.due_at
                ? new Date(f.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "Scheduled"}</span>
            </div>
          )) : <p className="muted-copy">No follow-ups scheduled.</p>}
        </article>

        <article className="panel detail-panel">
          <h3>Files</h3>
          {(files ?? []).length ? (files ?? []).map((file) => (
            <div className="simple-row" key={file.id}>
              <strong>{file.filename}</strong>
              <span>{file.visibility}</span>
            </div>
          )) : <p className="muted-copy">No client files uploaded yet.</p>}
        </article>

        <article className="panel detail-panel">
          <h3>Latest updates</h3>
          {(updates ?? []).length ? (updates ?? []).map((u) => (
            <div className="simple-row" key={u.id}>
              <strong>{u.summary}</strong>
              <span>{new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
          )) : <p className="muted-copy">No updates yet.</p>}
        </article>
      </section>
    </div>
  );
}
