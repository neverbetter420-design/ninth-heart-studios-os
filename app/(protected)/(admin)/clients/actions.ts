"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { PortalFeedbackState } from "@/lib/portal-feedback";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateClients(id?: string) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
}

class ClientMemberError extends Error {}

function validId(value: string | null): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
  if (!id || (status !== "active" && status !== "archived")) throw new Error("Invalid client status.");

  const { error } = await supabase
    .from("clients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error("Client status was not saved.");
  revalidateClients(id);
}

/** Link an existing user profile (found by email) to a client as a member. */
export async function addClientMember(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const clientId = clean(formData.get("client_id"));
  const email = clean(formData.get("email"))?.toLowerCase();
  if (!validId(clientId)) throw new ClientMemberError("This client could not be identified. Refresh the page and retry.");
  if (!email || email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ClientMemberError("Enter a valid account email.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (profileError) throw new ClientMemberError("Could not look up that account. Please retry.");
  if (!profile) {
    throw new ClientMemberError("No account found for that email. They need to sign up first.");
  }

  const { data: membership, error } = await supabase
    .from("client_memberships")
    .insert({ client_id: clientId, profile_id: profile.id, member_role: "client" })
    .select("client_id, profile_id, member_role")
    .single();
  if (error) {
    if (error.code === "23505") throw new ClientMemberError("That person is already a member of this client.");
    throw new ClientMemberError("Member access was not confirmed. Refresh the member list before retrying.");
  }
  if (!membership || membership.client_id !== clientId || membership.profile_id !== profile.id || membership.member_role !== "client") {
    throw new ClientMemberError("Member access was not confirmed. Refresh the member list before retrying.");
  }
  revalidateClients(clientId);
  revalidatePath("/portal", "layout");
}

export async function removeClientMember(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseClient();

  const clientId = clean(formData.get("client_id"));
  const profileId = clean(formData.get("profile_id"));
  if (!validId(clientId) || !validId(profileId)) {
    throw new ClientMemberError("This member could not be identified. Refresh the page and retry.");
  }

  const { data: membership, error } = await supabase
    .from("client_memberships")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId)
    .select("client_id, profile_id")
    .single();
  if (error || !membership || membership.client_id !== clientId || membership.profile_id !== profileId) {
    throw new ClientMemberError("Removal was not confirmed. Refresh the member list before retrying.");
  }
  revalidateClients(clientId);
  revalidatePath("/portal", "layout");
}

export async function addClientMemberWithFeedback(_previous: PortalFeedbackState, data: FormData): Promise<PortalFeedbackState> {
  await requireAdmin();
  try {
    await addClientMember(data);
    return { status: "success", message: "Member added to this client." };
  } catch (error) {
    return { status: "error", message: error instanceof ClientMemberError ? error.message : "Unable to add the member. Refresh the member list before retrying." };
  }
}

export async function removeClientMemberWithFeedback(_previous: PortalFeedbackState, data: FormData): Promise<PortalFeedbackState> {
  await requireAdmin();
  try {
    await removeClientMember(data);
    return { status: "success", message: "Member removed from this client." };
  } catch (error) {
    return { status: "error", message: error instanceof ClientMemberError ? error.message : "Unable to remove the member. Refresh the member list before retrying." };
  }
}

export async function setClientStatusWithFeedback(_previous: PortalFeedbackState, data: FormData): Promise<PortalFeedbackState> {
  const status = clean(data.get("status"));
  try {
    await setClientStatus(data);
    return { status: "success", message: status === "archived" ? "Client archived." : "Client restored." };
  } catch {
    return { status: "error", message: "Unable to update the client. Please retry." };
  }
}
