"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deriveNewLead } from "@/lib/flowkeep";
import {
  completenessScore, findBusinesses, isSameBusiness, parseFinderForm, websiteHost,
  type FinderParams, type FinderSource,
} from "@/lib/lead-finder";
import type { NicheKey } from "@/lib/prospect-scan";

type Db = Awaited<ReturnType<typeof createClient>>;
type SavedResult = {
  id: string; search_id: string; business_name: string; source_ref: string;
  address: string | null; phone: string | null; website: string | null;
  duplicate: boolean; imported: boolean; import_status: string;
};

const finderURL = (message: string, id?: string) =>
  "/leads/discover?" + new URLSearchParams({
    ...(id ? { search: id } : {}),
    msg: message.slice(0, 250),
  }).toString();

async function importOne(db: Db, userId: string, searchId: string, id: string) {
  // An atomic claim prevents two simultaneous clicks from importing twice.
  const { data: row, error: claimError } = await db.from("lead_search_results")
    .update({ import_status: "importing", updated_at: new Date().toISOString() })
    .eq("id", id).eq("search_id", searchId)
    .eq("duplicate", false).eq("imported", false).eq("import_status", "ready")
    .not("website", "is", null)
    .select("id,search_id,business_name,source_ref,address,phone,website,duplicate,imported,import_status")
    .maybeSingle();
  if (claimError || !row) return false;
  const result = row as SavedResult;
  let createdLeadId: string | null = null;
  try {
    // Recheck CRM and prospects AFTER claiming a result.
    const [{ data: leads, error: lErr }, { data: prospects, error: pErr }] = await Promise.all([
      db.from("leads").select("id,business_name,website").limit(1000),
      db.from("prospects").select("id,source_ref,business_name,website,address").limit(1000),
    ]);
    if (lErr || pErr || (leads?.length ?? 0) === 1000 || (prospects?.length ?? 0) === 1000)
      throw new Error("Cannot safely check duplicate records.");
    const same = (candidate: { business_name?: string | null; website?: string | null; source_ref?: string | null; address?: string | null }) =>
      isSameBusiness(result, candidate);
    if (leads?.some(same) || prospects?.some(same)) {
      await db.from("lead_search_results").update({
        duplicate: true, import_status: "duplicate", updated_at: new Date().toISOString(),
      }).eq("id", result.id).eq("import_status", "importing");
      return false;
    }
    const initial = deriveNewLead({ acquisitionType: "outbound", hasContactMethod: Boolean(result.phone) });
    const { data: lead, error: insertError } = await db.from("leads").insert({
      business_name: result.business_name,
      website: result.website,
      phone: result.phone,
      owner_id: userId,
      acquisition_type: "outbound",
      ...initial,
      status: "prospect",
      next_action: "Verify business contact and website",
      next_action_kind: "research",
      metadata: {
        source: "nhs_lead_finder_v2", source_ref: result.source_ref,
        search_result_id: result.id, address: result.address,
      },
    }).select("id").single();
    if (insertError || !lead) throw new Error("Could not save lead.");
    createdLeadId = lead.id;
    const { error: confirmError } = await db.from("lead_search_results").update({
      imported: true, import_status: "imported", lead_id: lead.id,
      updated_at: new Date().toISOString(),
    }).eq("id", result.id).eq("import_status", "importing");
    if (confirmError) throw new Error("Lead saved, but its search result needs reconciliation.");
    return true;
  } catch {
    if (!createdLeadId) {
      // No lead was inserted: make this candidate safely retryable.
      await db.from("lead_search_results").update({import_status:"ready"})
        .eq("id",result.id).eq("import_status","importing");
    }
    // If a lead was created, keep the claim until an admin can reconcile it:
    // never retry blindly and risk duplicating that saved lead.
    return false;
  }
}

async function executeSearch(db: Db, userId: string, id: string) {
  const { data: request } = await db.from("lead_search_requests")
    .select("id,source,location,industry,niches,radius_mi,result_limit,auto_import,top_count,status,started_at")
    .eq("id", id).eq("owner_id", userId).maybeSingle();
  if (!request) return "Search request not found.";
  if (request.status === "complete") return "This search is already complete.";
  const stale = request.status === "searching" &&
    request.started_at && Date.now() - new Date(request.started_at).getTime() > 120_000;
  if (request.status === "searching" && !stale) return "Search already running.";
  const { data: claimed } = await db.from("lead_search_requests").update({
    status: "searching", error_message: null,
    started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", id).eq("owner_id", userId).eq("status", request.status)
    .select("id").maybeSingle();
  if (!claimed) return "Search was already claimed.";
  try {
    const params: FinderParams = {
      source: request.source as FinderSource,
      location: request.location,
      industry: request.industry,
      niches: request.niches as NicheKey[],
      radius_mi: request.radius_mi,
      result_limit: request.result_limit,
      auto_import: request.auto_import,
      top_count: request.top_count,
    };
    const discovered = await findBusinesses(params);
    const [{ data: leads, error: lErr }, { data: prospects, error: pErr }] = await Promise.all([
      db.from("leads").select("id,business_name,website").limit(1000),
      db.from("prospects").select("id,source_ref,business_name,address,website").limit(1000),
    ]);
    if (lErr || pErr || (leads?.length ?? 0) === 1000 || (prospects?.length ?? 0) === 1000)
      throw new Error("Saved lead index cannot be verified. Try again later.");
    const duplicates = [...(leads ?? []), ...(prospects ?? [])];
    for (const business of discovered.slice(0, params.result_limit)) {
      const existing = duplicates.some(other => isSameBusiness({
        source_ref: business.source_ref, business_name: business.name,
        website: business.website, address: business.address,
      }, other));
      const score = completenessScore(business);
      const { error } = await db.from("lead_search_results").upsert({
        search_id: id,
        source_ref: business.source_ref,
        business_name: business.name,
        industry: business.category,
        address: business.address,
        city: params.location,
        phone: business.phone,
        website: business.website,
        email: null, // A listing does not prove email address ownership.
        maps_url: business.source_ref.match(/^(node|way|relation):\d+$/)
          ? "https://www.openstreetmap.org/" + business.source_ref.replace(":", "/")
          : "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent([business.name, business.address].filter(Boolean).join(", ")),
        source: params.source,
        discovery_score: score,
        duplicate: existing,
        import_status: existing ? "duplicate" : websiteHost(business.website) ? "ready" : "needs_verification",
        details: { social_profiles: business.social_profiles },
        updated_at: new Date().toISOString(),
      }, { onConflict: "search_id,source_ref", ignoreDuplicates: true });
      if (error) throw new Error("Could not store business search results.");
    }
    let imported = 0;
    if (params.auto_import) {
      const { data: eligible, error: eligibleError } = await db.from("lead_search_results")
        .select("id").eq("search_id", id).eq("import_status", "ready")
        .eq("duplicate", false).eq("imported", false)
        .order("discovery_score", { ascending: false })
        .limit(params.top_count);
      if (eligibleError) throw new Error("Could not verify auto-import candidates.");
      for (const item of eligible ?? []) {
        if (await importOne(db, userId, id, item.id)) imported++;
      }
    }
    const { error: finishError } = await db.from("lead_search_requests").update({
      status: "complete", result_count: Math.min(discovered.length, params.result_limit),
      imported_count: imported, error_message: null, completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id).eq("owner_id", userId);
    if (finishError) throw new Error("Could not finalize search history.");
    return "Found " + Math.min(discovered.length, params.result_limit) + " businesses. " +
      imported + " imported to Leads.";
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 400) : "Search provider unavailable.";
    await db.from("lead_search_requests").update({
      status: "error", error_message: message,
      completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", id).eq("owner_id", userId);
    return message;
  }
}

export async function queueLeadSearch(form: FormData): Promise<never> {
  const { user } = await requireAdmin();
  let params: FinderParams;
  try { params = parseFinderForm(form); }
  catch (e) { redirect(finderURL(e instanceof Error ? e.message : "Invalid search.")); }
  if (params.source === "geoapify" && !process.env.GEOAPIFY_API_KEY?.trim())
    redirect(finderURL("Connect your private Places API key before selecting Geoapify."));
  const db = await createClient();
  const { data, error } = await db.from("lead_search_requests").insert({
    ...params, owner_id: user.id, status: "queued",
  }).select("id").single();
  if (error || !data) redirect(finderURL("Search history could not be created. Check database setup."));
  const result = await executeSearch(db, user.id, data.id);
  revalidatePath("/leads/discover");
  revalidatePath("/leads");
  redirect(finderURL(result, data.id));
}

export async function retryLeadSearch(id: string): Promise<never> {
  const { user } = await requireAdmin();
  const db = await createClient();
  const message = await executeSearch(db, user.id, id);
  revalidatePath("/leads/discover");
  redirect(finderURL(message, id));
}

export async function importLeadSearchResult(id: string): Promise<never> {
  const { user } = await requireAdmin();
  const db = await createClient();
  const { data: result } = await db.from("lead_search_results")
    .select("search_id").eq("id", id).maybeSingle();
  if (!result) redirect(finderURL("Business result not found."));
  const { data: search } = await db.from("lead_search_requests")
    .select("id").eq("id", result.search_id).eq("owner_id", user.id).maybeSingle();
  if (!search) redirect(finderURL("Search is not available."));
  const ok = await importOne(db, user.id, search.id, id);
  if (ok) {
    const { count } = await db.from("lead_search_results")
      .select("id", { count: "exact", head: true }).eq("search_id", search.id).eq("imported", true);
    await db.from("lead_search_requests").update({ imported_count: count ?? 0 })
      .eq("id", search.id);
  }
  revalidatePath("/leads/discover");
  revalidatePath("/leads");
  redirect(finderURL(ok ? "Lead imported. Website audit can now be queued from Lead Intelligence." :
    "Import skipped. Verify the website, check for duplicates, or retry later.", search.id));
}
