"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  APPROVED_SOURCES,
  FIT_DIMENSIONS,
  isApprovedSource,
  isOpportunityStatus,
  totalFitScore,
  estimateGigFit,
  validSourceListingUrl,
  type FitBreakdown,
  type FitDimensionKey,
} from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function revalidateRadar(id?: string) {
  revalidatePath("/opportunities");
  if (id) revalidatePath(`/opportunities/${id}`);
}

/* ---------------- Opportunities ---------------- */

export async function addOpportunity(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const title = clean(formData.get("title"));
  const source = clean(formData.get("source"));
  if (!title || !source || !isApprovedSource(source)) {
    redirect("/opportunities?error=Title+and+an+approved+source+are+required.");
  }

  const externalId = clean(formData.get("external_id"));
  const url = clean(formData.get("url"));
  if (url && !validSourceListingUrl(source, url)) {
    redirect("/opportunities?error=" + encodeURIComponent("Use a valid secure listing link from the selected platform."));
  }
  const brief = (clean(formData.get("brief")) ?? "").slice(0, 4000);
  const budgetRaw = clean(formData.get("budget_usd"));
  const budgetUsd = budgetRaw !== null && Number.isFinite(Number(budgetRaw)) && Number(budgetRaw) > 0 && Number(budgetRaw) < 10000000
    ? Number(budgetRaw) : null;
  const preview = brief ? estimateGigFit(title, brief, budgetUsd) : null;

  // Exact-duplicate guard: same source + external id.
  if (externalId) {
    const { data: exact } = await supabase
      .from("opportunities")
      .select("id")
      .eq("source", source)
      .eq("external_id", externalId)
      .maybeSingle();
    if (exact) {
      redirect(`/opportunities/${exact.id}?error=Duplicate+of+an+existing+opportunity.`);
    }
  }

  // Fuzzy-duplicate guard: similar title already tracked.
  const { data: similar } = await supabase
    .from("opportunities")
    .select("id, title")
    .eq("source", source)
    .ilike("title", `%${title.slice(0, 40).replace(/[%_]/g, "")}%`)
    .limit(3);
  if (similar && similar.length > 0) {
    const names = similar.map((s) => s.title).join(", ");
    redirect(
      `/opportunities?error=${encodeURIComponent(`Possible duplicate of: ${names}. Review before adding.`)}`
    );
  }

  const { data, error } = await supabase
    .from("opportunities")
    .insert({
      title,
      source,
      external_id: externalId,
      url,
      status: "new",
      metadata: {
        origin: "manual",
        ...(brief ? { brief } : {}),
        ...(budgetUsd !== null ? { budget_usd: budgetUsd, budget_currency: "USD" } : {}),
        ...(preview ? { fit_preview: preview } : {}),
      },
    })
    .select("id")
    .single();

  if (error || !data) redirect("/opportunities?error=Could+not+save+the+opportunity.");
  redirect(`/opportunities/${data.id}`);
}

export async function updateOpportunityStatus(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("opportunity_id"));
  const status = clean(formData.get("status"));
  if (!id || !status || !isOpportunityStatus(status)) return;

  await supabase
    .from("opportunities")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateRadar(id);
}

export async function scoreOpportunity(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("opportunity_id"));
  if (!id) return;

  const breakdown = {} as FitBreakdown;
  for (const dim of FIT_DIMENSIONS) {
    const raw = clean(formData.get(`fit_${dim.key}`));
    const val = Math.max(0, Math.min(20, Number(raw) || 0));
    breakdown[dim.key as FitDimensionKey] = val;
  }
  const score = totalFitScore(breakdown);
  const fit = clean(formData.get("fit"));

  // Merge breakdown into metadata without clobbering other keys.
  const { data: current } = await supabase
    .from("opportunities")
    .select("metadata")
    .eq("id", id)
    .single();
  const metadata = { ...((current?.metadata as Record<string, unknown>) ?? {}), fit_breakdown: breakdown };

  await supabase
    .from("opportunities")
    .update({ score, fit, metadata, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateRadar(id);
}

export async function deleteOpportunity(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("opportunity_id"));
  if (!id) return;
  await supabase.from("opportunities").delete().eq("id", id);
  redirect("/opportunities");
}

/* ---------------- Proposals ---------------- */

export async function createProposal(formData: FormData) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const opportunityId = clean(formData.get("opportunity_id"));
  const title = clean(formData.get("title")) ?? "Untitled proposal";
  if (!opportunityId) return;

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      opportunity_id: opportunityId,
      title,
      content: "",
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return;
  revalidateRadar(opportunityId);
}

export async function updateProposal(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("proposal_id"));
  if (!id) return;

  const title = clean(formData.get("title"));
  const content = formData.get("content");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (title) patch.title = title;
  if (content !== null) patch.content = String(content);

  const { data } = await supabase
    .from("proposals")
    .update(patch)
    .eq("id", id)
    .select("opportunity_id")
    .single();
  if (data) revalidateRadar(data.opportunity_id);
}

export async function markProposalSent(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("proposal_id"));
  if (!id) return;

  const { data } = await supabase
    .from("proposals")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("opportunity_id")
    .single();
  if (!data) return;

  // Move the opportunity to submitted when its proposal goes out.
  await supabase
    .from("opportunities")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", data.opportunity_id)
    .eq("status", "proposal");
  revalidateRadar(data.opportunity_id);
}

export async function deleteProposal(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = clean(formData.get("proposal_id"));
  if (!id) return;
  const { data } = await supabase
    .from("proposals")
    .select("opportunity_id")
    .eq("id", id)
    .single();
  await supabase.from("proposals").delete().eq("id", id);
  if (data) revalidateRadar(data.opportunity_id);
}
