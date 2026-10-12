import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

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

  const [{ data: tasks }, { data: approvals }, { data: files }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("approvals")
      .select("id, title, status, requested_at, decided_at")
      .eq("project_id", projectId)
      .order("requested_at", { ascending: false }),
    supabase
      .from("files")
      .select("id, filename, visibility, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="content-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow electric">Client Project</p>
          <h2>{project.name}</h2>
          <p className="page-description">{project.status} · {project.progress}% complete</p>
        </div>
      </header>

      <section className="client-detail-grid">
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
          <h3>Approvals</h3>
          {(approvals ?? []).length ? (approvals ?? []).map((approval) => (
            <div className="simple-row" key={approval.id}>
              <strong>{approval.title}</strong>
              <span>{approval.status}</span>
            </div>
          )) : <p className="muted-copy">No approvals waiting.</p>}
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
      </section>
    </div>
  );
}
