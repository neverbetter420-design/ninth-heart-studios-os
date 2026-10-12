"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  ON_HOLD_STAGE,
  PIPELINE_STAGES,
  stageLabel,
} from "@/lib/delivery";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_UPLOAD_BYTES,
  PROJECT_FILES_BUCKET,
  projectObjectPath,
  sanitizeFilename,
  type FileVisibility,
} from "@/lib/files";

const VALID_STATUSES = new Set([
  ...PIPELINE_STAGES.map((s) => s.key),
  ON_HOLD_STAGE,
]);

const VALID_MILESTONE_STATUSES = new Set(["not_started", "in_progress", "complete"]);
const VALID_TASK_STATUSES = new Set(["not_started", "in_progress", "complete", "blocked"]);
const VALID_LAUNCH_KINDS = new Set(["payment", "checklist", "followup"]);

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateProject(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { project_id: string; event_type: string; summary: string; client_visible?: boolean }
) {
  const { user } = await requireAdmin();
  await supabase.from("activities").insert({
    project_id: input.project_id,
    actor_id: user.id,
    event_type: input.event_type,
    summary: input.summary,
    client_visible: input.client_visible ?? false,
  });
}

/* ---------------- Project ---------------- */

export async function moveProject(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const status = clean(formData.get("status"));
  if (!projectId || !status || !VALID_STATUSES.has(status)) return;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("id", projectId)
    .single();
  if (!project) return;

  const { error } = await supabase
    .from("projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) return;

  await logActivity(supabase, {
    project_id: projectId,
    event_type: "stage_moved",
    summary: `${project.name} moved to ${stageLabel(status)}`,
    client_visible: true,
  });
  revalidateProject(projectId);
}

export async function updateProjectDetails(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  if (!projectId) return;

  const progressRaw = clean(formData.get("progress"));
  const progress = progressRaw === null ? null : Math.max(0, Math.min(100, Number(progressRaw)));
  const dueDate = clean(formData.get("due_date"));
  const notes = formData.get("internal_notes");
  const notesValue = notes === null ? undefined : String(notes).trim() || null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (progress !== null && Number.isFinite(progress)) patch.progress = progress;
  if (dueDate !== undefined) patch.due_date = dueDate || null;
  if (notesValue !== undefined) patch.internal_notes = notesValue;

  await supabase.from("projects").update(patch).eq("id", projectId);
  revalidateProject(projectId);
}

/* ---------------- Milestones ---------------- */

export async function createMilestone(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  if (!projectId || !title) return;

  const dueDate = clean(formData.get("due_date"));
  const { data: existing } = await supabase
    .from("milestones")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (existing?.position ?? -1) + 1;

  await supabase.from("milestones").insert({
    project_id: projectId,
    title,
    due_date: dueDate || null,
    position,
  });
  revalidateProject(projectId);
}

export async function setMilestoneStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const milestoneId = clean(formData.get("milestone_id"));
  const status = clean(formData.get("status"));
  if (!milestoneId || !status || !VALID_MILESTONE_STATUSES.has(status)) return;

  const { data: milestone } = await supabase
    .from("milestones")
    .select("id, project_id, title")
    .eq("id", milestoneId)
    .single();
  if (!milestone) return;

  await supabase
    .from("milestones")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", milestoneId);

  if (status === "complete") {
    await logActivity(supabase, {
      project_id: milestone.project_id,
      event_type: "milestone_complete",
      summary: `Milestone complete: ${milestone.title}`,
      client_visible: true,
    });
  }
  revalidateProject(milestone.project_id);
}

export async function deleteMilestone(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const milestoneId = clean(formData.get("milestone_id"));
  if (!milestoneId) return;
  const { data: milestone } = await supabase
    .from("milestones")
    .select("project_id")
    .eq("id", milestoneId)
    .single();
  await supabase.from("milestones").delete().eq("id", milestoneId);
  if (milestone) revalidateProject(milestone.project_id);
}

/* ---------------- Tasks ---------------- */

export async function createTask(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  if (!projectId || !title) return;

  const dueAt = clean(formData.get("due_at"));
  const priority = clean(formData.get("priority")) ?? "normal";
  const clientVisible = formData.get("client_visible") === "on";

  await supabase.from("tasks").insert({
    project_id: projectId,
    title,
    due_at: dueAt || null,
    priority: ["low", "normal", "high"].includes(priority) ? priority : "normal",
    client_visible: clientVisible,
  });
  revalidateProject(projectId);
}

export async function setTaskStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const taskId = clean(formData.get("task_id"));
  const status = clean(formData.get("status"));
  if (!taskId || !status || !VALID_TASK_STATUSES.has(status)) return;

  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();
  await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (task) revalidateProject(task.project_id);
}

export async function toggleTaskVisibility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const taskId = clean(formData.get("task_id"));
  if (!taskId) return;
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id, client_visible")
    .eq("id", taskId)
    .single();
  if (!task) return;
  await supabase
    .from("tasks")
    .update({ client_visible: !task.client_visible, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  revalidateProject(task.project_id);
}

export async function deleteTask(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const taskId = clean(formData.get("task_id"));
  if (!taskId) return;
  const { data: task } = await supabase
    .from("tasks")
    .select("project_id")
    .eq("id", taskId)
    .single();
  await supabase.from("tasks").delete().eq("id", taskId);
  if (task) revalidateProject(task.project_id);
}

/* ---------------- Launch items ---------------- */

export async function createLaunchItem(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const label = clean(formData.get("label"));
  const kind = clean(formData.get("kind"));
  if (!projectId || !label || !kind || !VALID_LAUNCH_KINDS.has(kind)) return;
  const dueAt = clean(formData.get("due_at"));

  await supabase.from("launch_items").insert({
    project_id: projectId,
    label,
    kind,
    due_at: dueAt || null,
  });
  revalidateProject(projectId);
}

export async function toggleLaunchItem(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const itemId = clean(formData.get("launch_item_id"));
  if (!itemId) return;
  const { data: item } = await supabase
    .from("launch_items")
    .select("project_id, done, label, kind")
    .eq("id", itemId)
    .single();
  if (!item) return;
  const done = !item.done;
  await supabase
    .from("launch_items")
    .update({
      done,
      done_at: done ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (done && item.kind === "payment") {
    await logActivity(supabase, {
      project_id: item.project_id,
      event_type: "payment_gate",
      summary: `Payment gate cleared: ${item.label}`,
      client_visible: false,
    });
  }
  revalidateProject(item.project_id);
}

export async function deleteLaunchItem(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const itemId = clean(formData.get("launch_item_id"));
  if (!itemId) return;
  const { data: item } = await supabase
    .from("launch_items")
    .select("project_id")
    .eq("id", itemId)
    .single();
  await supabase.from("launch_items").delete().eq("id", itemId);
  if (item) revalidateProject(item.project_id);
}

/* ---------------- Approvals ---------------- */

export async function requestApproval(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  if (!projectId || !title) return;

  await supabase.from("approvals").insert({
    project_id: projectId,
    title,
    status: "pending",
    requested_by: user.id,
  });
  await logActivity(supabase, {
    project_id: projectId,
    event_type: "approval_requested",
    summary: `Approval requested: ${title}`,
    client_visible: true,
  });
  revalidateProject(projectId);
}

export async function decideApproval(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const approvalId = clean(formData.get("approval_id"));
  const decision = clean(formData.get("decision"));
  if (!approvalId || (decision !== "approved" && decision !== "declined")) return;

  const { data: approval } = await supabase
    .from("approvals")
    .select("project_id, title")
    .eq("id", approvalId)
    .single();
  if (!approval) return;

  await supabase
    .from("approvals")
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", approvalId);

  await logActivity(supabase, {
    project_id: approval.project_id,
    event_type: decision === "approved" ? "approval_granted" : "approval_declined",
    summary: `${approval.title} — ${decision === "approved" ? "approved" : "changes requested"}`,
    client_visible: true,
  });
  revalidateProject(approval.project_id);
}

/* ---------------- Project files ---------------- */

export async function uploadProjectFile(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const projectId = clean(formData.get("project_id"));
  const visibility: FileVisibility =
    clean(formData.get("visibility")) === "internal" ? "internal" : "client";
  const file = formData.get("file");
  if (!projectId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;

  const filename = sanitizeFilename(file.name);
  const objectPath = projectObjectPath(project.client_id, project.id, visibility, file.name);

  const { error: uploadError } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) return;

  const { error: metaError } = await supabase.from("files").insert({
    project_id: project.id,
    uploaded_by: user.id,
    object_path: objectPath,
    filename,
    mime_type: file.type || null,
    size_bytes: file.size,
    visibility,
  });
  if (metaError) {
    // Don't leave an orphaned object in the bucket.
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove([objectPath]);
    return;
  }

  await logActivity(supabase, {
    project_id: project.id,
    event_type: "file_uploaded",
    summary: `File uploaded: ${filename}${visibility === "internal" ? " (internal)" : ""}`,
    client_visible: visibility === "client",
  });

  revalidateProject(projectId);
}

export async function deleteProjectFile(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const fileId = clean(formData.get("file_id"));
  if (!fileId) return;

  const { data: file } = await supabase
    .from("files")
    .select("id, project_id, object_path, filename")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) return;

  await supabase.storage.from(PROJECT_FILES_BUCKET).remove([file.object_path]);
  await supabase.from("files").delete().eq("id", fileId);

  await logActivity(supabase, {
    project_id: file.project_id,
    event_type: "file_deleted",
    summary: `File removed: ${file.filename}`,
    client_visible: false,
  });

  revalidateProject(file.project_id);
}
