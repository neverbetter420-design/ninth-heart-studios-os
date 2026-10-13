"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Send a Muse draft via Gmail. Per-send approval is structural: the sender
 * must type (or confirm) the recipient address on every send — there is no
 * "send to all" and no automatic dispatch. Every send is logged.
 */
export async function sendDraftEmail(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const draftId = clean(formData.get("draft_id"));
  const to = clean(formData.get("to"));
  if (!draftId || !to) return;

  const { data: draft } = await supabase
    .from("muse_drafts")
    .select("id, subject, body, lead_id, opportunity_id")
    .eq("id", draftId)
    .eq("status", "draft")
    .single();
  if (!draft) return;

  try {
    const { messageId } = await sendEmail({
      to,
      subject: draft.subject,
      body: draft.body,
    });

    await supabase.from("sent_emails").insert({
      to_address: to,
      subject: draft.subject,
      body: draft.body,
      draft_id: draft.id,
      lead_id: draft.lead_id,
      opportunity_id: draft.opportunity_id,
      sent_by: user.id,
      provider_message_id: messageId,
    });

    // Archive the draft once sent — it's done its job.
    await supabase.from("muse_drafts").update({ status: "archived" }).eq("id", draft.id);
  } catch (err) {
    // Log the failure too — the audit trail doesn't hide misses.
    await supabase.from("sent_emails").insert({
      to_address: to,
      subject: `[FAILED] ${draft.subject}`,
      body: `Send failed: ${err instanceof Error ? err.message : "unknown error"}\n\n---\n${draft.body}`,
      draft_id: draft.id,
      lead_id: draft.lead_id,
      opportunity_id: draft.opportunity_id,
      sent_by: user.id,
    });
  }

  revalidatePath("/muse");
  revalidatePath("/automations");
}
