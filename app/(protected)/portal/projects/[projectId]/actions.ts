"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
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
