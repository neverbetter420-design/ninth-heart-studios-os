import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/projects/ActivityTimeline";
import { ApprovalSection } from "@/components/projects/ApprovalSection";
import { DocumentSection } from "@/components/projects/DocumentSection";
import { FileSection, type WorkspaceFile } from "@/components/projects/FileSection";
import { LaunchGateSection } from "@/components/projects/LaunchGateSection";
import { MessageThread } from "@/components/projects/MessageThread";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { TaskSection } from "@/components/projects/TaskSection";
import { sendProjectMessage } from "../actions";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { LaunchItem, Milestone, ProjectDocument, ProjectMessage, ProjectTask } from "@/lib/supabase/types";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  progress: number;
  due_date: string | null;
  internal_notes: string | null;
  clients: { name: string | null } | { name: string | null }[] | null;
};

function clientName(rel: ProjectRow["clients"]): string | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0]?.name ?? null;
  return rel.name ?? null;
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const [
    { data: rawProject },
    { data: rawMilestones },
    { data: rawTasks },
    { data: rawApprovals },
    { data: rawLaunchItems },
    { data: rawActivities },
    { data: rawFiles },
    { data: rawMessages },
    { data: rawDocuments },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, progress, due_date, internal_notes, clients(name)")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("milestones")
      .select("id, project_id, title, due_date, status, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, project_id, title, status, priority, due_at, client_visible")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("approvals")
      .select("id, title, status, requested_at, decided_at, client_comment")
      .eq("project_id", projectId)
      .order("requested_at", { ascending: false }),
    supabase
      .from("launch_items")
      .select("id, project_id, label, kind, due_at, done, done_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("activities")
      .select("id, event_type, summary, client_visible, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("files")
      .select("id, filename, visibility, mime_type, size_bytes, created_at, object_path")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
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

  if (!rawProject) notFound();
  const project = rawProject as ProjectRow;

  const files: WorkspaceFile[] = await Promise.all(
    (rawFiles ?? []).map(
      async (f: {
        id: string;
        filename: string;
        visibility: string;
        mime_type: string | null;
        size_bytes: number | null;
        created_at: string;
        object_path: string;
      }) => {
        const { data } = await supabase.storage
          .from("project-files")
          .createSignedUrl(f.object_path, 3600);
        return {
          id: f.id,
          filename: f.filename,
          visibility: f.visibility,
          mime_type: f.mime_type,
          size_bytes: f.size_bytes,
          created_at: f.created_at,
          downloadUrl: data?.signedUrl ?? null,
        };
      },
    ),
  );

  return (
    <div className="content-wrap">
      <ProjectOverview project={project} clientName={clientName(project.clients)} />

      <div className="workspace-grid">
        <div className="workspace-span-7">
          <MilestoneSection projectId={projectId} milestones={(rawMilestones ?? []) as Milestone[]} />
        </div>
        <div className="workspace-span-5">
          <ApprovalSection
            projectId={projectId}
            approvals={(rawApprovals ?? []) as { id: string; title: string; status: string; requested_at: string; decided_at: string | null; client_comment: string | null }[]}
          />
        </div>
        <div className="workspace-span-12">
          <TaskSection projectId={projectId} tasks={(rawTasks ?? []) as ProjectTask[]} />
        </div>
        <div className="workspace-span-6">
          <LaunchGateSection projectId={projectId} items={(rawLaunchItems ?? []) as LaunchItem[]} />
        </div>
        <div className="workspace-span-6">
          <ActivityTimeline
            activities={(rawActivities ?? []) as { id: string; event_type: string; summary: string; client_visible: boolean; created_at: string }[]}
          />
        </div>
        <div className="workspace-span-12">
          <FileSection projectId={projectId} files={files} />
        </div>
        <div className="workspace-span-6">
          <MessageThread
            projectId={projectId}
            messages={(rawMessages ?? []) as ProjectMessage[]}
            currentUserId={user.id}
            sendAction={sendProjectMessage}
            otherLabel="Client"
            title="Messages"
          />
        </div>
        <div className="workspace-span-6">
          <DocumentSection
            projectId={projectId}
            documents={(rawDocuments ?? []) as ProjectDocument[]}
          />
        </div>
      </div>
    </div>
  );
}
