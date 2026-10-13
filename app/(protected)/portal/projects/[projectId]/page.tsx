import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { milestoneStatusLabel, stageLabel } from "@/lib/delivery";
import { decideApproval, deleteClientFile, sendPortalMessage, uploadClientFile } from "./actions";
import { MessageThread } from "@/components/projects/MessageThread";
import { formatBytes } from "@/lib/files";
import type { ProjectDocument, ProjectMessage } from "@/lib/supabase/types";

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
  const { user } = await requireUser();
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
    { data: messages },
    { data: documents },
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
      .select("id, filename, visibility, mime_type, size_bytes, created_at, object_path, uploaded_by")
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
    supabase
      .from("messages")
      .select("id, project_id, sender_id, body, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, project_id, title, kind, file_id, external_url, notes, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  const pendingApprovals = ((approvals ?? []) as ApprovalRow[]).filter((a) => a.status === "pending");
  const decidedApprovals = ((approvals ?? []) as ApprovalRow[]).filter((a) => a.status !== "pending");

  type PortalFile = {
    id: string;
    filename: string;
    size_bytes: number | null;
    created_at: string;
    uploaded_by: string | null;
    object_path: string;
  };
  const portalFiles = await Promise.all(
    ((files ?? []) as PortalFile[]).map(async (f) => {
      const { data } = await supabase.storage
        .from("project-files")
        .createSignedUrl(f.object_path, 3600);
      return { ...f, downloadUrl: data?.signedUrl ?? null as string | null };
    }),
  );

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
          <form action={uploadClientFile} className="mini-form file-upload-form" style={{ marginBottom: 10 }}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="file" name="file" required aria-label="Choose a file to upload" />
            <button type="submit" className="mini-button go">
              Upload
            </button>
          </form>
          {portalFiles.length ? portalFiles.map((file) => (
            <div className="simple-row" key={file.id}>
              <strong>
                {file.downloadUrl ? (
                  <a href={file.downloadUrl} download={file.filename}>{file.filename}</a>
                ) : (
                  file.filename
                )}
              </strong>
              <span>
                {formatBytes(file.size_bytes)}
                {file.uploaded_by === user.id ? (
                  <form action={deleteClientFile} className="mini-form" style={{ display: "inline", marginLeft: 8 }}>
                    <input type="hidden" name="file_id" value={file.id} />
                    <button type="submit" className="mini-button danger">
                      Delete
                    </button>
                  </form>
                ) : null}
              </span>
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

        <article className="panel detail-panel">
          <h3>Documents</h3>
          {(documents ?? []).length ? ((documents ?? []) as ProjectDocument[]).map((doc) => (
            <div className="simple-row" key={doc.id}>
              <strong>{doc.title}</strong>
              <span>
                {doc.external_url ? (
                  <a href={doc.external_url} target="_blank" rel="noopener noreferrer" className="mini-button">Open</a>
                ) : doc.kind}
              </span>
            </div>
          )) : <p className="muted-copy">No documents shared yet.</p>}
        </article>
      </section>

      <div style={{ marginTop: 14 }}>
        <MessageThread
          projectId={projectId}
          messages={((messages ?? []) as ProjectMessage[])}
          currentUserId={user.id}
          sendAction={sendPortalMessage}
          otherLabel="Ninth Heart Studios"
          title="Messages"
        />
      </div>
    </div>
  );
}
