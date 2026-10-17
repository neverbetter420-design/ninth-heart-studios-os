"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  ON_HOLD_STAGE,
  PIPELINE_STAGES,
  stageLabel,
} from "@/lib/delivery";
import { createClient } from "@/lib/supabase/server";
import type { PortalFeedbackState } from "@/lib/portal-feedback";
import { templateBody } from "@/lib/templates";
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
  revalidatePath("/portal");
  revalidatePath("/portal/projects");
  revalidatePath(`/portal/projects/${projectId}`);
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
  if (!projectId || !status || !VALID_STATUSES.has(status)) throw new Error("Invalid project stage.");

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("Project not found.");

  const { error } = await supabase
    .from("projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id")
    .single();
  if (error) throw new Error("Project stage update failed.");

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
  if (!projectId) throw new Error("Project not selected.");

  const progressRaw = clean(formData.get("progress"));
  const progress = progressRaw === null ? null : Math.max(0, Math.min(100, Number(progressRaw)));
  const dueDate = clean(formData.get("due_date"));
  const notes = formData.get("internal_notes");
  const notesValue = notes === null ? undefined : String(notes).trim() || null;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (progress !== null && Number.isFinite(progress)) patch.progress = progress;
  if (dueDate !== undefined) patch.due_date = dueDate || null;
  if (notesValue !== undefined) patch.internal_notes = notesValue;

  const { error } = await supabase.from("projects").update(patch).eq("id", projectId).select("id").single();
  if (error) throw new Error("Project details update failed.");
  revalidateProject(projectId);
}

/* ---------------- Milestones ---------------- */

function deliveryDate(value: FormDataEntryValue | null) {
  const date = clean(value);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid due date.");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Choose a valid due date.");
  }
  return date;
}

export async function createMilestone(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  if (!projectId || !title || title.length > 120) throw new Error("A project and milestone title of up to 120 characters are required.");

  const dueDate = deliveryDate(formData.get("due_date"));
  const { data: existing, error: positionError } = await supabase
    .from("milestones")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) throw new Error("Could not prepare the milestone. Please retry.");
  const position = (existing?.position ?? -1) + 1;

  const { data: milestone, error } = await supabase
    .from("milestones")
    .insert({ project_id: projectId, title, due_date: dueDate, position })
    .select("id, project_id, title")
    .single();
  if (error || !milestone?.id || milestone.project_id !== projectId || milestone.title !== title) {
    throw new Error("Milestone creation was not confirmed. Please retry.");
  }
  revalidateProject(projectId);
}

export async function setMilestoneStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const milestoneId = clean(formData.get("milestone_id"));
  const status = clean(formData.get("status"));
  if (!milestoneId || !status || !VALID_MILESTONE_STATUSES.has(status)) throw new Error("Invalid milestone status.");

  const { data: milestone, error: lookupError } = await supabase
    .from("milestones")
    .select("id, project_id, title, status")
    .eq("id", milestoneId)
    .single();
  if (lookupError || !milestone || milestone.id !== milestoneId) throw new Error("Milestone not found.");

  const { data: saved, error } = await supabase
    .from("milestones")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", milestoneId)
    .eq("project_id", milestone.project_id)
    .select("id, project_id, status")
    .single();
  if (error || !saved || saved.id !== milestoneId || saved.project_id !== milestone.project_id || saved.status !== status) {
    throw new Error("Milestone status update was not confirmed. Please retry.");
  }

  if (status === "complete" && milestone.status !== "complete") {
    await logActivity(supabase, {
      project_id: milestone.project_id,
      event_type: "milestone_complete",
      summary: `Milestone complete: ${milestone.title}`,
      client_visible: true,
    }).catch(() => undefined);
  }
  revalidateProject(milestone.project_id);
}

export async function deleteMilestone(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const milestoneId = clean(formData.get("milestone_id"));
  if (!milestoneId) throw new Error("Milestone not selected.");
  const { data: milestone, error } = await supabase
    .from("milestones")
    .delete()
    .eq("id", milestoneId)
    .select("id, project_id")
    .single();
  if (error || !milestone || milestone.id !== milestoneId || !milestone.project_id) {
    throw new Error("Milestone deletion was not confirmed. It may already have been removed.");
  }
  revalidateProject(milestone.project_id);
}

/* ---------------- Tasks ---------------- */

export async function createTask(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  if (!projectId || !title || title.length > 160) throw new Error("A project and task title of up to 160 characters are required.");

  const dueDate = deliveryDate(formData.get("due_at"));
  const priority = clean(formData.get("priority")) ?? "normal";
  if (!["low", "normal", "high"].includes(priority)) throw new Error("Invalid task priority.");
  const clientVisible = formData.get("client_visible") === "on";

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      project_id: projectId,
      title,
      due_at: dueDate ? `${dueDate}T00:00:00Z` : null,
      priority,
      client_visible: clientVisible,
    })
    .select("id, project_id, title, client_visible")
    .single();
  if (error || !task?.id || task.project_id !== projectId || task.title !== title || task.client_visible !== clientVisible) {
    throw new Error("Task creation was not confirmed. Please retry.");
  }
  revalidateProject(projectId);
}

export async function setTaskStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const taskId = clean(formData.get("task_id"));
  const status = clean(formData.get("status"));
  if (!taskId || !status || !VALID_TASK_STATUSES.has(status)) throw new Error("Invalid task status.");

  const { data: task, error: lookupError } = await supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .single();
  if (lookupError || !task || task.id !== taskId) throw new Error("Task not found.");
  const { data: saved, error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("project_id", task.project_id)
    .select("id, project_id, status")
    .single();
  if (error || !saved || saved.id !== taskId || saved.project_id !== task.project_id || saved.status !== status) {
    throw new Error("Task status update was not confirmed. Please retry.");
  }
  revalidateProject(task.project_id);
}

export async function toggleTaskVisibility(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const taskId = clean(formData.get("task_id"));
  const visibility = clean(formData.get("client_visible"));
  if (!taskId || (visibility !== "true" && visibility !== "false")) throw new Error("Invalid task visibility.");
  const clientVisible = visibility === "true";
  const { data: task, error: lookupError } = await supabase
    .from("tasks")
    .select("id, project_id, client_visible")
    .eq("id", taskId)
    .single();
  if (lookupError || !task || task.id !== taskId) throw new Error("Task not found.");
  const { data: saved, error } = await supabase
    .from("tasks")
    .update({ client_visible: clientVisible, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("project_id", task.project_id)
    .eq("client_visible", task.client_visible)
    .select("id, project_id, client_visible")
    .single();
  if (error || !saved || saved.id !== taskId || saved.project_id !== task.project_id || saved.client_visible !== clientVisible) {
    throw new Error("Task visibility update was not confirmed. Refresh and retry.");
  }
  revalidateProject(task.project_id);
}

export async function deleteTask(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const taskId = clean(formData.get("task_id"));
  if (!taskId) throw new Error("Task not selected.");
  const { data: task, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .select("id, project_id")
    .single();
  if (error || !task || task.id !== taskId || !task.project_id) {
    throw new Error("Task deletion was not confirmed. It may already have been removed.");
  }
  revalidateProject(task.project_id);
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
  if (!projectId) return;
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/projects/${encodeURIComponent(projectId)}?upload_error=Choose%20a%20file.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    redirect(`/projects/${encodeURIComponent(projectId)}?upload_error=Files%20must%20be%2025%20MB%20or%20smaller.`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) redirect(`/projects/${encodeURIComponent(projectId)}?upload_error=Project%20not%20found.`);

  const filename = sanitizeFilename(file.name);
  const objectPath = projectObjectPath(project.client_id, project.id, visibility, file.name);

  const { error: uploadError } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(objectPath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) redirect(`/projects/${encodeURIComponent(projectId)}?upload_error=${encodeURIComponent(uploadError.message)}`);

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
    redirect(`/projects/${encodeURIComponent(projectId)}?upload_error=${encodeURIComponent(metaError.message)}`);
  }

  await logActivity(supabase, {
    project_id: project.id,
    event_type: "file_uploaded",
    summary: `File uploaded: ${filename}${visibility === "internal" ? " (internal)" : ""}`,
    client_visible: visibility === "client",
  });

  revalidateProject(projectId);
  redirect(`/projects/${encodeURIComponent(projectId)}?upload_ok=File%20uploaded%20successfully.`);
}

class ProjectFileActionError extends Error {}

export async function deleteProjectFile(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const fileId = clean(formData.get("file_id"));
  if (!fileId) throw new ProjectFileActionError("Choose a file to delete.");

  const { data: file, error: lookupError } = await supabase
    .from("files")
    .select("id, project_id, object_path, filename")
    .eq("id", fileId)
    .maybeSingle();
  if (lookupError || !file || file.id !== fileId) {
    throw new ProjectFileActionError("File not found. Refresh the project before retrying.");
  }

  // Remove the project reference first. If storage cleanup fails, the private
  // object remains recoverable; do not delete the only visible metadata after
  // an unconfirmed storage operation.
  const { data: removed, error: deleteError } = await supabase
    .from("files")
    .delete()
    .eq("id", fileId)
    .eq("project_id", file.project_id)
    .select("id, project_id")
    .single();
  if (deleteError || !removed || removed.id !== fileId || removed.project_id !== file.project_id) {
    throw new ProjectFileActionError("File removal was not confirmed. Refresh before retrying.");
  }
  revalidateProject(file.project_id);

  try {
    const { data: removedObjects, error: storageError } = await supabase.storage.from(PROJECT_FILES_BUCKET).remove([file.object_path]);
    if (storageError || !Array.isArray(removedObjects)) throw storageError ?? new Error("Storage response was not confirmed.");
  } catch {
    // Metadata has been removed but the private object may remain. Never
    // encourage a blind retry after this partial-success state.
    throw new ProjectFileActionError("File was unlisted, but private storage cleanup failed. Contact an admin to reconcile it.");
  }

  await logActivity(supabase, {
    project_id: file.project_id,
    event_type: "file_deleted",
    summary: `File removed: ${file.filename}`,
    client_visible: false,
  }).catch(() => undefined);
}

export async function deleteProjectFileWithFeedback(_previous: PortalFeedbackState, data: FormData): Promise<PortalFeedbackState> {
  await requireAdmin();
  try {
    await deleteProjectFile(data);
    return { status: "success", message: "File deleted from the project and private storage." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ProjectFileActionError
        ? error.message
        : "Unable to confirm file deletion. Refresh and check the project before retrying.",
    };
  }
}

/* ---------------- Messages ---------------- */

const VALID_DOCUMENT_KINDS = new Set(["contract", "proposal", "invoice", "handoff", "other"]);

export async function sendProjectMessage(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const body = clean(formData.get("body"));
  if (!projectId || !body || body.length > 2000) return;

  await supabase.from("messages").insert({
    project_id: projectId,
    sender_id: user.id,
    body,
  });

  await logActivity(supabase, {
    project_id: projectId,
    event_type: "message_sent",
    summary: "New message from the studio",
    client_visible: true,
  });
  revalidateProject(projectId);
}

/* ---------------- Documents ---------------- */

class DocumentActionError extends Error {}

export async function createDocument(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  const kind = clean(formData.get("kind"));
  if (!projectId || !title || title.length > 160 || !kind || !VALID_DOCUMENT_KINDS.has(kind)) {
    throw new DocumentActionError("Enter a document title (up to 160 characters) and a valid kind.");
  }

  const externalUrl = clean(formData.get("external_url"));
  if (externalUrl) {
    let url: URL;
    try { url = new URL(externalUrl); } catch { throw new DocumentActionError("Enter a valid http or https document link."); }
    if (!["http:", "https:"].includes(url.protocol) || externalUrl.length > 500) {
      throw new DocumentActionError("Enter a valid http or https document link (up to 500 characters).");
    }
  }
  const templateId = clean(formData.get("template_id"));
  let notes = clean(formData.get("notes"));
  if (notes && notes.length > 280) throw new DocumentActionError("Keep document notes to 280 characters.");

  // A chosen document template fills the notes unless the user wrote their own.
  if (templateId && !notes) {
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("content")
      .eq("id", templateId)
      .eq("category", "document")
      .eq("active", true)
      .maybeSingle();
    if (templateError || !template) throw new DocumentActionError("The selected document template is unavailable. Choose another template or enter notes.");
    notes = templateBody(template.content) || null;
  }

  const { data: document, error } = await supabase.from("documents").insert({
    project_id: projectId,
    title,
    kind,
    external_url: externalUrl,
    notes,
    created_by: user.id,
  }).select("id, project_id").single();
  if (error || !document?.id || document.project_id !== projectId) {
    throw new DocumentActionError("The document was not confirmed saved. Refresh the project before retrying.");
  }

  await logActivity(supabase, {
    project_id: projectId,
    event_type: "document_shared",
    summary: `Document shared: ${title}`,
    client_visible: true,
  }).catch(() => undefined);
  revalidateProject(projectId);
}

export async function deleteDocument(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const documentId = clean(formData.get("document_id"));
  const projectId = clean(formData.get("project_id"));
  if (!documentId || !projectId) throw new DocumentActionError("Select a document and project to remove.");
  const { data: doc, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("project_id", projectId)
    .select("id, project_id")
    .single();
  if (error || doc?.id !== documentId || doc.project_id !== projectId) {
    throw new DocumentActionError("Document removal was not confirmed. Refresh the project and try again.");
  }
  revalidateProject(doc.project_id);
}

export async function createDocumentWithFeedback(_previous: PortalFeedbackState, data: FormData): Promise<PortalFeedbackState> {
  await requireAdmin();
  try {
    await createDocument(data);
    return { status: "success", message: "Document shared." };
  } catch (error) {
    return { status: "error", message: error instanceof DocumentActionError ? error.message : "Unable to confirm the document was shared. Refresh before retrying." };
  }
}

export async function deleteDocumentWithFeedback(_previous: PortalFeedbackState, data: FormData): Promise<PortalFeedbackState> {
  await requireAdmin();
  try {
    await deleteDocument(data);
    return { status: "success", message: "Document removed from this project." };
  } catch (error) {
    return { status: "error", message: error instanceof DocumentActionError ? error.message : "Unable to confirm document removal. Refresh before retrying." };
  }
}

/* ---------------- Revision rounds ---------------- */

export async function startRevisionRound(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  if (!projectId) return;

  const includedRaw = clean(formData.get("included_rounds"));
  const included = includedRaw === null ? 3 : Math.max(0, Math.min(25, Number(includedRaw) || 0));

  const { data: latest } = await supabase
    .from("revision_rounds")
    .select("round_number")
    .eq("project_id", projectId)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const next = ((latest as { round_number: number } | null)?.round_number ?? 0) + 1;

  await supabase.from("revision_rounds").insert({
    project_id: projectId,
    round_number: next,
    status: "open",
    included_rounds: included,
  });

  await logActivity(supabase, {
    project_id: projectId,
    event_type: "revision_round_started",
    summary: `Revision round ${next} opened (${included} included in package)`,
    client_visible: true,
  });
  void user;
  revalidateProject(projectId);
}

export async function closeRevisionRound(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const roundId = clean(formData.get("round_id"));
  if (!roundId) return;

  const { data: round } = await supabase
    .from("revision_rounds")
    .select("id, project_id, round_number")
    .eq("id", roundId)
    .single();
  if (!round) return;

  await supabase
    .from("revision_rounds")
    .update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", roundId);

  await logActivity(supabase, {
    project_id: round.project_id,
    event_type: "revision_round_closed",
    summary: `Revision round ${round.round_number} closed`,
    client_visible: true,
  });
  revalidateProject(round.project_id);
}

/* ---------------- Feedback pins ---------------- */

function clampCoord(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

export async function createFeedbackPin(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const roundId = clean(formData.get("round_id"));
  const comment = clean(formData.get("comment"));
  if (!roundId || !comment || comment.length > 2000) return;

  const pageUrl = clean(formData.get("page_url")) ?? "";
  const x = clampCoord(clean(formData.get("x")));
  const y = clampCoord(clean(formData.get("y")));

  const { data: pin } = await supabase
    .from("feedback_pins")
    .insert({
      round_id: roundId,
      page_url: pageUrl.slice(0, 500),
      x,
      y,
      comment,
      created_by: user.id,
    })
    .select("id")
    .single();
  void pin;

  const { data: round } = await supabase
    .from("revision_rounds")
    .select("project_id")
    .eq("id", roundId)
    .single();
  if (round) revalidateProject(round.project_id);
}

export async function resolveFeedbackPin(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const pinId = clean(formData.get("pin_id"));
  const resolved = formData.get("resolved") === "true";
  if (!pinId) return;

  await supabase
    .from("feedback_pins")
    .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", pinId);

  const { data: pin } = await supabase
    .from("feedback_pins")
    .select("round_id")
    .eq("id", pinId)
    .single();
  const { data: round } = pin
    ? await supabase
        .from("revision_rounds")
        .select("project_id")
        .eq("id", (pin as { round_id: string }).round_id)
        .single()
    : { data: null };
  if (round) revalidateProject((round as { project_id: string }).project_id);
}

/* ---------------- Change orders ---------------- */

function cleanMoney(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export async function createChangeOrder(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const description = clean(formData.get("description"));
  if (!projectId || !description || description.length > 4000) return;

  const { data: order } = await supabase
    .from("change_orders")
    .insert({
      project_id: projectId,
      source_pin_id: clean(formData.get("source_pin_id")),
      description,
      fee_impact: cleanMoney(clean(formData.get("fee_impact"))),
      timeline_impact: clean(formData.get("timeline_impact")),
      status: "draft",
    })
    .select("id")
    .single();

  if (order) {
    await logActivity(supabase, {
      project_id: projectId,
      event_type: "change_order_drafted",
      summary: `Change order drafted: ${description.slice(0, 80)}`,
      client_visible: false,
    });
  }
  revalidateProject(projectId);
}

export async function convertPinToChangeOrder(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const pinId = clean(formData.get("pin_id"));
  if (!pinId) return;

  const { data: pin } = await supabase
    .from("feedback_pins")
    .select("id, comment, round_id, revision_rounds(project_id, round_number)")
    .eq("id", pinId)
    .single();
  if (!pin) return;

  const round = Array.isArray(pin.revision_rounds) ? pin.revision_rounds[0] : pin.revision_rounds;
  if (!round?.project_id) return;

  await supabase.from("change_orders").insert({
    project_id: round.project_id,
    source_pin_id: pin.id,
    description: `From revision round ${round.round_number} feedback: "${pin.comment.slice(0, 300)}${pin.comment.length > 300 ? "…" : ""}" — price the fee and timeline impact.`,
    status: "draft",
  });

  await logActivity(supabase, {
    project_id: round.project_id,
    event_type: "change_order_drafted",
    summary: `Feedback pin converted to change order draft`,
    client_visible: false,
  });
  revalidateProject(round.project_id);
}

export async function proposeChangeOrder(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const orderId = clean(formData.get("change_order_id"));
  if (!orderId) return;

  const { data: order } = await supabase
    .from("change_orders")
    .update({
      status: "proposed",
      proposed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "draft")
    .select("project_id")
    .single();
  if (order) {
    await logActivity(supabase, {
      project_id: order.project_id,
      event_type: "change_order_proposed",
      summary: `Change order proposed to client`,
      client_visible: true,
    });
    revalidateProject(order.project_id);
  }
}

export async function decideChangeOrder(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const orderId = clean(formData.get("change_order_id"));
  const decision = clean(formData.get("decision"));
  if (!orderId || (decision !== "approved" && decision !== "declined")) return;

  const { data: order } = await supabase
    .from("change_orders")
    .update({
      status: decision,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .in("status", ["draft", "proposed"])
    .select("project_id")
    .single();
  if (order) {
    await logActivity(supabase, {
      project_id: order.project_id,
      event_type: "change_order_decided",
      summary: `Change order ${decision}`,
      client_visible: true,
    });
    revalidateProject(order.project_id);
  }
}

/* ---------------- Project creation ---------------- */

export async function createProject(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const name = clean(formData.get("name"));
  const clientId = clean(formData.get("client_id"));
  const dueDate = clean(formData.get("due_date"));
  if (!name || !clientId) {
    redirect("/projects?error=Project+name+and+client+are+required.");
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) redirect("/projects?error=That+client+does+not+exist.");

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name,
      client_id: clientId,
      status: "discovery",
      progress: 0,
      due_date: dueDate || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !project) redirect("/projects?error=Could+not+create+the+project.");

  await logActivity(supabase, {
    project_id: project.id,
    event_type: "project_created",
    summary: `${name} created for ${client.name}`,
    client_visible: true,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function moveProjectWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await moveProject(formData); return { status: "success", message: "Project stage updated." }; }
  catch { return { status: "error", message: "Couldn't update the project stage. Try again." }; }
}
export async function updateProjectDetailsWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await updateProjectDetails(formData); return { status: "success", message: "Project details saved." }; }
  catch { return { status: "error", message: "Project details weren't saved. Review the fields and retry." }; }
}
export async function setTaskStatusWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await setTaskStatus(formData); return { status: "success", message: "Task status updated." }; }
  catch { return { status: "error", message: "Task status wasn't saved. Please retry." }; }
}
export async function createTaskWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await createTask(formData); return { status: "success", message: "Task added." }; }
  catch { return { status: "error", message: "Task wasn't added. Check the fields and try again." }; }
}
export async function toggleTaskVisibilityWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await toggleTaskVisibility(formData); return { status: "success", message: "Task visibility saved." }; }
  catch { return { status: "error", message: "Task visibility wasn't saved. Refresh and try again." }; }
}
export async function deleteTaskWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await deleteTask(formData); return { status: "success", message: "Task deleted." }; }
  catch { return { status: "error", message: "Task deletion wasn't confirmed. Refresh the project before retrying." }; }
}
export async function createMilestoneWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await createMilestone(formData); return { status: "success", message: "Milestone added." }; }
  catch { return { status: "error", message: "Milestone wasn't added. Check the fields and try again." }; }
}
export async function setMilestoneStatusWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await setMilestoneStatus(formData); return { status: "success", message: "Milestone status updated." }; }
  catch { return { status: "error", message: "Milestone status wasn't saved. Please retry." }; }
}
export async function deleteMilestoneWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try { await deleteMilestone(formData); return { status: "success", message: "Milestone deleted." }; }
  catch { return { status: "error", message: "Milestone deletion wasn't confirmed. Refresh the project before retrying." }; }
}
