"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PortalFeedbackState } from "@/lib/portal-feedback";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

/**
 * Client-side contract signing (in-app click-to-accept).
 *
 * The RLS policy "Clients sign own contracts" enforces the boundary at the
 * database level: only sent contracts on the client's own projects can move
 * to signed. This action fills the audit fields and computes the
 * tamper-evident signature hash.
 */
export async function signContract(formData: FormData) {
  await requireUser();
  const supabase = await createClient();

  const contractId = clean(formData.get("contract_id"));
  const signerName = clean(formData.get("signer_name"));
  const signerEmail = clean(formData.get("signer_email"));
  const agreed = formData.get("agreed") === "on";

  if (!contractId || !signerName || !signerEmail || !agreed) throw new Error("Complete the signature fields.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) throw new Error("Invalid signer email.");

  // Fetch the contract body for the hash. RLS ensures it's theirs and sent.
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, body, project_id, status")
    .eq("id", contractId)
    .single();
  if (!contract || contract.status !== "sent") throw new Error("Contract is unavailable.");

  const signedAt = new Date().toISOString();
  const signatureHash = createHash("sha256")
    .update(`${contract.body}::${signerEmail.toLowerCase()}::${signedAt}`)
    .digest("hex");

  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const signerIp = forwarded ? forwarded.split(",")[0].trim() : null;

  const { error } = await supabase
    .from("contracts")
    .update({
      status: "signed",
      signed_at: signedAt,
      signer_name: signerName,
      signer_email: signerEmail.toLowerCase(),
      signature_hash: signatureHash,
      signer_ip: signerIp,
      updated_at: signedAt,
    })
    .eq("id", contractId)
    .eq("status", "sent")
    .select("id")
    .single();

  if (error) throw new Error("Contract signature could not be saved.");
  revalidatePath("/portal/contracts");
  revalidatePath("/portal");
  if (contract.project_id) revalidatePath(`/portal/projects/${contract.project_id}`);
}

export async function signContractWithFeedback(_previous: PortalFeedbackState, formData: FormData): Promise<PortalFeedbackState> {
  try {
    await signContract(formData);
    return { status: "success", message: "Your contract was signed successfully." };
  } catch {
    return { status: "error", message: "The contract couldn't be signed. Please check your details and try again." };
  }
}
