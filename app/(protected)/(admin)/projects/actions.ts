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

export async function createDocument(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const projectId = clean(formData.get("project_id"));
  const title = clean(formData.get("title"));
  const kind = clean(formData.get("kind"));
  if (!projectId || !title || !kind || !VALID_DOCUMENT_KINDS.has(kind)) return;

  const externalUrl = clean(formData.get("external_url"));
  const notes = clean(formData.get("notes"));

  await supabase.from("documents").insert({
    project_id: projectId,
    title,
    kind,
    external_url: externalUrl,
    notes,
    created_by: user.id,
  });

  await logActivity(supabase, {
    project_id: projectId,
    event_type: "document_shared",
    summary: `Document shared: ${title}`,
    client_visible: true,
  });
  revalidateProject(projectId);
}

export async function deleteDocument(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const documentId = clean(formData.get("document_id"));
  if (!documentId) return;
  const { data: doc } = await supabase
    .from("documents")
    .select("project_id")
    .eq("id", documentId)
    .single();
  await supabase.from("documents").delete().eq("id", documentId);
  if (doc) revalidateProject(doc.project_id);
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
