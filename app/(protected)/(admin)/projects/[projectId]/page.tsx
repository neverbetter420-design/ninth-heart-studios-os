import Link from "next/link";
import { ProjectSectionLink } from "@/components/projects/ProjectSectionLink";
import { DesignGallery } from "@/components/projects/DesignGallery";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/projects/ActivityTimeline";
import { ApprovalSection } from "@/components/projects/ApprovalSection";
import { DocumentSection } from "@/components/projects/DocumentSection";
import { FileSection, type WorkspaceFile } from "@/components/projects/FileSection";
import { LaunchGateSection } from "@/components/projects/LaunchGateSection";
import { MessageThread } from "@/components/projects/MessageThread";
import { MilestoneSection } from "@/components/projects/MilestoneSection";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { RevisionSection } from "@/components/projects/RevisionSection";
import { TaskSection } from "@/components/projects/TaskSection";
import { sendProjectMessage } from "../actions";
import { requireAdmin } from "@/lib/auth";
import { analyzeScopeCreep, buildScopeCorpus, type ScopeCreepVerdict } from "@/lib/muse";
import { createClient } from "@/lib/supabase/server";
import type { ChangeOrder, FeedbackPin, LaunchItem, Milestone, ProjectDocument, ProjectMessage, ProjectTask, RevisionRound } from "@/lib/supabase/types";

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
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<{ upload_error?: string; upload_ok?: string; section?: string }>;
}) {
  const { projectId } = await params;
  const { upload_error: uploadError, upload_ok: uploadOk, section: requestedSection } = searchParams ? await searchParams : {};
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const [
    { data: rawProject, error: projectError },
    { data: rawMilestones, error: milestonesError },
    { data: rawTasks, error: tasksError },
    { data: rawApprovals },
    { data: rawLaunchItems },
    { data: rawActivities },
    { data: rawFiles },
    { data: rawMessages },
    { data: rawDocuments, error: documentsError },
    { data: rawRounds },
    { data: rawChangeOrders },
    { data: rawDocTemplates, error: templatesError },
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
    supabase
      .from("revision_rounds")
      .select("id, project_id, round_number, status, included_rounds, started_at, closed_at, created_at")
      .eq("project_id", projectId)
      .order("round_number", { ascending: true }),
    supabase
      .from("change_orders")
      .select("id, project_id, source_pin_id, description, fee_impact, timeline_impact, status, proposed_at, decided_at, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("templates")
      .select("id, name")
      .eq("category", "document")
      .eq("active", true)
      .order("name"),
  ]);

  if (projectError || milestonesError || tasksError || documentsError || templatesError) {
    throw new Error("Unable to load project tasks, milestones or documents. Please try again.");
  }
  if (!rawProject) notFound();
  const project = rawProject as ProjectRow;

  const rounds = (rawRounds ?? []) as RevisionRound[];
  const activeRound =
    rounds.find((r) => r.status === "open") ?? rounds[rounds.length - 1] ?? null;

  const { data: rawPins } = activeRound
    ? await supabase
        .from("feedback_pins")
        .select("id, round_id, page_url, x, y, comment, resolved, resolved_at, created_by, created_at")
        .eq("round_id", activeRound.id)
        .order("created_at", { ascending: true })
    : { data: [] };
  const pins = (rawPins ?? []) as FeedbackPin[];
  const changeOrders = (rawChangeOrders ?? []) as ChangeOrder[];

  // Phase 9 — deterministic scope-creep guard over recent client requests.
  const corpus = buildScopeCorpus({
    projectName: project.name,
    internalNotes: project.internal_notes,
    milestoneTitles: ((rawMilestones ?? []) as { title: string }[]).map((m) => m.title),
    taskTitles: ((rawTasks ?? []) as { title: string }[]).map((t) => t.title),
    documentTitles: ((rawDocuments ?? []) as { title: string }[]).map((d) => d.title),
  });
  const scopeVerdicts: ScopeCreepVerdict[] = [
    ...(((rawMessages ?? []) as { id: string; body: string }[])
      .slice(-10)
      .map((m) => analyzeScopeCreep(`message:${m.id}`, m.body, corpus))),
    ...(pins
      .filter((p) => !p.resolved)
      .map((p) => analyzeScopeCreep(`pin:${p.id}`, p.comment, corpus))),
  ];

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
    <div className="content-wrap studio-workspace studio-workspace-admin">
      {uploadError && <p role="alert" className="lead-form-error">{uploadError}</p>}
      {uploadOk && <p role="status" className="notice">{uploadOk}</p>}
      <ProjectOverview project={project} clientName={clientName(project.clients)} />

      <nav className="studio-workspace-nav" aria-label="Project destinations">
        <ProjectSectionLink href="#workspace-priorities">Working plan</ProjectSectionLink>
        <Link href="/muse/project-guide" className="management-text-link">Muse Guide · preview</Link>
        <ProjectSectionLink href="?section=creative#workspace-collaboration">Design & feedback</ProjectSectionLink>
        <ProjectSectionLink href="?section=files#workspace-resources">Files & documents</ProjectSectionLink>
        <ProjectSectionLink href="?section=messages#workspace-conversation">Conversation</ProjectSectionLink>
        <ProjectSectionLink href="?section=delivery#workspace-delivery">Delivery</ProjectSectionLink>
      </nav>

      <DesignGallery files={files} filesHref="?section=files#workspace-resources" />

      <section className="nocturne-workspace-focus" id="workspace-priorities" aria-label="Project priorities">
        <div className="nocturne-workspace-heading">
          <p className="eyebrow electric">The working plan</p>
          <h3>Keep the project moving.</h3>
          <p>Milestones, decisions, and the work that matters next.</p>
        </div>
        <div className="workspace-grid">
          <div className="workspace-span-7">
            <MilestoneSection projectId={projectId} milestones={(rawMilestones ?? []) as Milestone[]} />
          </div>
          <div className="workspace-span-5">
            <ApprovalSection projectId={projectId} approvals={(rawApprovals ?? []) as { id: string; title: string; status: string; requested_at: string; decided_at: string | null; client_comment: string | null }[]} />
          </div>
          <div className="workspace-span-12">
            <TaskSection projectId={projectId} tasks={(rawTasks ?? []) as ProjectTask[]} />
          </div>
        </div>
      </section>

      <details className="nocturne-workspace-disclosure" id="workspace-collaboration" open={requestedSection === "creative"}>
        <summary><span><strong>Design & feedback</strong><small>Revision rounds, visual comments, and scope decisions</small></span></summary>
        <div className="workspace-grid">
          <div className="workspace-span-12">
            <RevisionSection projectId={projectId} rounds={rounds} activeRound={activeRound} pins={pins} changeOrders={changeOrders} scopeVerdicts={scopeVerdicts} />
          </div>
        </div>
      </details>

      <details className="nocturne-workspace-disclosure" id="workspace-resources" open={requestedSection === "files" || requestedSection === "documents"}>
        <summary><span><strong>Files & documents</strong><small>Uploads, shared assets, and project paperwork</small></span></summary>
        <div className="workspace-grid">
          <div className="workspace-span-12"><FileSection projectId={projectId} files={files} /></div>
          <div className="workspace-span-12"><DocumentSection projectId={projectId} documents={(rawDocuments ?? []) as ProjectDocument[]} docTemplates={(rawDocTemplates ?? []) as { id: string; name: string }[]} /></div>
        </div>
      </details>

      <details className="nocturne-workspace-disclosure" id="workspace-conversation" open={requestedSection === "messages"}>
        <summary><span><strong>Project conversation</strong><small>Messages between you and your client</small></span></summary>
        <div className="workspace-grid">
          <div className="workspace-span-12"><MessageThread projectId={projectId} messages={(rawMessages ?? []) as ProjectMessage[]} currentUserId={user.id} sendAction={sendProjectMessage} otherLabel="Client" title="Messages" /></div>
        </div>
      </details>

      <details className="nocturne-workspace-disclosure" id="workspace-delivery" open={requestedSection === "delivery"}>
        <summary><span><strong>Delivery & studio activity</strong><small>Launch checks and the project activity timeline</small></span></summary>
        <div className="workspace-grid">
          <div className="workspace-span-6"><LaunchGateSection projectId={projectId} items={(rawLaunchItems ?? []) as LaunchItem[]} /></div>
          <div className="workspace-span-6"><ActivityTimeline activities={(rawActivities ?? []) as { id: string; event_type: string; summary: string; client_visible: boolean; created_at: string }[]} /></div>
        </div>
      </details>
    </div>
  );
}
