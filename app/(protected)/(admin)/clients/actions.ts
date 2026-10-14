"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateClients(id?: string) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
}

export async function createClient(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createSupabaseClient();

  const name = clean(formData.get("name"));
  const website = clean(formData.get("website"));
  const primaryEmail = clean(formData.get("primary_email"));
  if (!name) redirect("/clients?error=Client+name+is+required.");
  if (primaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail)) {
    redirect("/clients?error=Enter+a+valid+email+or+leave+it+blank.");
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({ name, website, primary_email: primaryEmail, status: "active", created_by: user.id })
    .select("id")
    .single();
  if (error || !data) redirect("/clients?error=Could+not+create+the+client.");
  redirect(`/clients/${data.id}`);
}

export async function setClientStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const id = clean(formData.get("client_id"));
  const status = clean(formData.get("status"));
  if (!id || (status !== "active" && status !== "archived")) return;

  await supabase
    .from("clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateClients(id);
}

/** Link an existing user profile (found by email) to a client as a member. */
export async function addClientMember(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const clientId = clean(formData.get("client_id"));
  const email = clean(formData.get("email"))?.toLowerCase();
  if (!clientId || !email) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (!profile) {
    redirect(`/clients/${clientId}?error=No+account+found+for+that+email.+They+need+to+sign+up+first.`);
  }

  const { error } = await supabase
    .from("client_memberships")
    .insert({ client_id: clientId, profile_id: profile.id, member_role: "client" });
  if (error) {
    redirect(`/clients/${clientId}?error=That+person+is+already+a+member+of+this+client.`);
  }
  revalidateClients(clientId);
}

export async function removeClientMember(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const clientId = clean(formData.get("client_id"));
  const profileId = clean(formData.get("profile_id"));
  if (!clientId || !profileId) return;

  await supabase
    .from("client_memberships")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId);
  revalidateClients(clientId);
}
