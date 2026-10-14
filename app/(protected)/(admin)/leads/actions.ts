"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  deriveNewLead,
  outcomePatch,
  consultationPatch,
  pacificLocalDateTimeToDate,
  QUICK_LOG_OUTCOMES,
  type AcquisitionType,
  type QuickLogOutcome,
} from "@/lib/flowkeep";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function createLead(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const businessName = clean(formData.get("business_name"));
  if (!businessName) redirect("/leads?error=Business%20name%20is%20required.#quick-capture");

  const acquisitionType: AcquisitionType = formData.get("acquisition_type") === "inbound" ? "inbound" : "outbound";
  const email = clean(formData.get("email"));
  const phone = clean(formData.get("phone"));
  const rawWebsite = clean(formData.get("website"));
  const contactName = clean(formData.get("contact_name"));

  let website: string | null = null;
  if (rawWebsite) {
    try {
      const parsed = new URL(rawWebsite);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") website = parsed.toString();
    } catch {
      redirect("/leads?error=Website%20must%20be%20a%20valid%20http%20or%20https%20URL.#quick-capture");
    }
    if (!website) redirect("/leads?error=Website%20must%20use%20http%20or%20https.#quick-capture");
  }

  const scoreValue = clean(formData.get("score"));
  const score = scoreValue ? Math.max(0, Math.min(100, Number(scoreValue))) : null;
  const createdAt = new Date();
  const derived = deriveNewLead({
    acquisitionType,
    hasContactMethod: Boolean(email || phone),
    createdAt,
  });

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      business_name: businessName,
      contact_name: contactName,
      email,
      phone,
      website,
      score: Number.isFinite(score) ? score : null,
      acquisition_type: acquisitionType,
      owner_id: user.id,
      status: acquisitionType === "inbound" ? "new" : "prospect",
      ...derived,
    })
    .select("id")
    .single();

  if (error || !lead) {
    redirect(`/leads?error=${encodeURIComponent(error?.message ?? "Lead capture failed.")}#quick-capture`);
  }

  await supabase.from("activities").insert({
    lead_id: lead.id,
    actor_id: user.id,
    event_type: "lead_created",
    summary: `${acquisitionType === "inbound" ? "Inbound" : "Outbound"} lead captured`,
    metadata: { next_action: derived.next_action },
  });

  revalidatePath("/");
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function logLeadOutcome(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const leadId = clean(formData.get("lead_id"));
  const rawOutcome = clean(formData.get("outcome"));

  if (!leadId || !rawOutcome || !QUICK_LOG_OUTCOMES.includes(rawOutcome as QuickLogOutcome)) return;
  const outcome = rawOutcome as QuickLogOutcome;
  const patch = outcomePatch(outcome, new Date());

  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw new Error(error.message);

  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    event_type: "lead_outcome",
    summary: outcome,
    metadata: { outcome, next_action: patch.next_action },
  });

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function scheduleConsultation(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const leadId = clean(formData.get("lead_id"));
  const localDateTime = clean(formData.get("consultation_at"));
  if (!leadId || !localDateTime) return;

  const consultationAt = pacificLocalDateTimeToDate(localDateTime);
  if (!consultationAt || consultationAt.getTime() <= Date.now()) {
    redirect(`/leads/${leadId}?error=Choose%20a%20future%20consultation%20time.`);
  }

  const patch = consultationPatch(consultationAt);
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) throw new Error(error.message);

  await supabase.from("activities").insert({
    lead_id: leadId,
    actor_id: user.id,
    event_type: "consultation_scheduled",
    summary: "Consultation scheduled",
    metadata: { consultation_at: consultationAt.toISOString() },
  });

  revalidatePath("/");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

/* ---------------- Lead → Project conversion ---------------- */

/**
 * Convert a won lead into a client + project.
 * Reuses the lead's linked client when one exists; otherwise creates
 * the client from the lead's business/contact details. Then creates
 * the project in Discovery and links the lead to the client.
 */
export async function convertLeadToProject(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const leadId = clean(formData.get("lead_id"));
  const projectName = clean(formData.get("project_name"));
  if (!leadId) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("id, business_name, contact_name, email, website, client_id")
    .eq("id", leadId)
    .single();
  if (!lead) return;

  let clientId = lead.client_id as string | null;
  if (!clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        name: lead.business_name,
        website: lead.website,
        primary_email: lead.email,
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (clientError || !client) return;
    clientId = client.id;
    await supabase
      .from("leads")
      .update({ client_id: clientId })
      .eq("id", leadId);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: projectName || `${lead.business_name} website`,
      client_id: clientId,
      status: "discovery",
      progress: 0,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (projectError || !project) return;

  await supabase.from("activities").insert({
    project_id: project.id,
    lead_id: leadId,
    actor_id: user.id,
    event_type: "project_created",
    summary: `Converted from lead ${lead.business_name}`,
    client_visible: true,
  });

  revalidatePath("/projects");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/projects/${project.id}`);
}
