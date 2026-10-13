"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  MAX_UPLOAD_BYTES,
  PROJECT_FILES_BUCKET,
  projectObjectPath,
} from "@/lib/files";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Client-side approval decision from the portal.
 * RLS ("Clients decide own pending approvals") enforces the boundary:
 * only pending approvals on the client's own projects, only the
 * approved/declined transition.
 */
export async function decideApproval(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createClient();

  const approvalId = clean(formData.get("approval_id"));
  const decision = clean(formData.get("decision"));
  const comment = clean(formData.get("client_comment"));
  if (!approvalId || (decision !== "approved" && decision !== "declined")) return;

  const { data: approval, error } = await supabase
    .from("approvals")
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      client_comment: comment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .select("project_id")
    .single();

  if (error || !approval) return;
  revalidatePath(`/portal/projects/${approval.project_id}`);
  revalidatePath("/portal");
}

/**
 * Client file upload from the portal.
 * Visibility is forced to "client" — the storage + metadata RLS policies
 * ("NHS clients upload client project files", "Clients add project file
 * metadata") enforce the project path, visibility segment, and
 * uploaded_by = auth.uid() boundaries on top of this.
 */
export async function uploadClientFile(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createClient();

  const projectId = clean(formData.get("project_id"));
  const file = formData.get("file");
  if (!projectId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;

  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;

  const objectPath = projectObjectPath(project.client_id, project.id, "client", file.name);

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
    filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    visibility: "client",
  });
  if (metaError) {
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove([objectPath]);
    return;
  }

  revalidatePath(`/portal/projects/${project.id}`);
  revalidatePath("/portal");
}

/**
 * Clients can only remove files they uploaded themselves — enforced by the
 * "Clients remove own project file metadata" policy (uploaded_by = auth.uid())
 * and the storage "delete own" policy (owner_id = auth.uid()).
 */
export async function deleteClientFile(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createClient();

  const fileId = clean(formData.get("file_id"));
  if (!fileId) return;

  const { data: file } = await supabase
    .from("files")
    .select("id, project_id, object_path, uploaded_by")
    .eq("id", fileId)
    .eq("uploaded_by", user.id)
    .maybeSingle();
  if (!file) return;

  await supabase.storage.from(PROJECT_FILES_BUCKET).remove([file.object_path]);
  await supabase.from("files").delete().eq("id", fileId);

  revalidatePath(`/portal/projects/${file.project_id}`);
  revalidatePath("/portal");
}

function cleanPortal(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Client-side message send from the portal.
 * RLS ("Clients send project messages") enforces the boundary:
 * only on the client's own projects.
 */
export async function sendPortalMessage(formData: FormData) {
  const { user } = await requireUser();
  const supabase = await createClient();

  const projectId = cleanPortal(formData.get("project_id"));
  const body = cleanPortal(formData.get("body"));
  if (!projectId || !body || body.length > 2000) return;

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      project_id: projectId,
      sender_id: user.id,
      body,
    })
    .select("id")
    .single();

  if (error || !message) return;
  revalidatePath(`/portal/projects/${projectId}`);
  revalidatePath("/portal");
}
