"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateContracts(id?: string) {
  revalidatePath("/contracts");
  if (id) revalidatePath(`/contracts/${id}`);
  revalidatePath("/portal");
}

export async function createContract(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const title = clean(formData.get("title"));
  const body = clean(formData.get("body")) ?? "";
  const projectId = clean(formData.get("project_id"));
  const opportunityId = clean(formData.get("opportunity_id"));
  if (!title || (!projectId && !opportunityId)) {
    redirect("/contracts?error=Title+and+a+project+or+opportunity+are+required.");
  }

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      title,
      body,
      project_id: projectId,
      opportunity_id: opportunityId,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) redirect("/contracts?error=Could+not+create+the+contract.");
  redirect(`/contracts/${data.id}`);
}

export async function updateContractBody(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("contract_id"));
  const title = clean(formData.get("title"));
  const body = formData.get("body");
  if (!id) return;

  // Only drafts are editable — sent contracts are locked.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title) patch.title = title;
  if (body !== null) patch.body = String(body);

  await supabase.from("contracts").update(patch).eq("id", id).eq("status", "draft");
  revalidateContracts(id);
}

export async function sendContract(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("contract_id"));
  if (!id) return;

  await supabase
    .from("contracts")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  revalidateContracts(id);
}

export async function voidContract(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("contract_id"));
  if (!id) return;

  await supabase
    .from("contracts")
    .update({ status: "voided", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "sent"]);
  revalidateContracts(id);
}

export async function deleteContract(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("contract_id"));
  if (!id) return;
  await supabase.from("contracts").delete().eq("id", id).eq("status", "draft");
  redirect("/contracts");
}
