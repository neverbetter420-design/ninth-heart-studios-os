"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  missingRequired,
  parseFields,
  parseLineItems,
  submissionTotal,
  type FormField,
} from "@/lib/forms";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Client-side form submission (fill + sign).
 *
 * RLS "Clients submit own forms" enforces pending → submitted on the
 * client's own projects at the database level. This action validates
 * required fields, computes invoice totals, and records the
 * tamper-evident signature hash.
 */
export async function submitForm(formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const submissionId = clean(formData.get("submission_id"));
  if (!submissionId) return;

  const { data: submission } = await supabase
    .from("form_submissions")
    .select("id, template_id, project_id, status")
    .eq("id", submissionId)
    .single();
  if (!submission || submission.status !== "pending") return;

  const { data: template } = await supabase
    .from("form_templates")
    .select("fields")
    .eq("id", submission.template_id)
    .maybeSingle();
  if (!template) return;

  const fields = parseFields(template.fields);
  const values: Record<string, unknown> = {};

  for (const f of fields) {
    const raw = formData.get(`field_${f.id}`);
    if (f.type === "checkbox") {
      values[f.id] = raw === "on";
    } else if (f.type === "line_items") {
      // Hidden JSON input maintained by the client-side line-items editor.
      try {
        values[f.id] = parseLineItems(raw ? JSON.parse(String(raw)) : []);
      } catch {
        values[f.id] = [];
      }
    } else if (f.type === "signature") {
      values[f.id] = "signed";
    } else {
      const text = clean(raw);
      if (f.type === "number" && text !== null) {
        const n = Number(text);
        values[f.id] = Number.isFinite(n) ? n : text;
      } else if (text !== null) {
        values[f.id] = text;
      }
    }
  }

  const missing = missingRequired(fields, values);
  if (missing.length > 0) return;

  const needsSignature = fields.some((f: FormField) => f.type === "signature");
  const signerName = clean(formData.get("signer_name"));
  const signerEmail = clean(formData.get("signer_email"));
  const agreed = formData.get("agreed") === "on";
  if (needsSignature && (!signerName || !signerEmail || !agreed)) return;
  if (signerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) return;

  const submittedAt = new Date().toISOString();
  const signatureHash = createHash("sha256")
    .update(`${JSON.stringify(values)}::${(signerEmail ?? "").toLowerCase()}::${submittedAt}`)
    .digest("hex");

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const signerIp = forwarded ? forwarded.split(",")[0].trim() : null;

  const { error } = await supabase
    .from("form_submissions")
    .update({
      status: "submitted",
      values,
      total_cents: submissionTotal(fields, values),
      submitted_at: submittedAt,
      signer_name: signerName,
      signer_email: signerEmail ? signerEmail.toLowerCase() : null,
      signature_hash: signatureHash,
      signer_ip: signerIp,
      updated_at: submittedAt,
    })
    .eq("id", submissionId);

  if (error) return;
  revalidatePath("/portal");
  if (submission.project_id) revalidatePath(`/portal/projects/${submission.project_id}`);
}
