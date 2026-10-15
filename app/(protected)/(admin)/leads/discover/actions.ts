"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  NICHES,
  geocode,
  discoverBusinesses,
  analyzeWebsite,
  scoreSignals,
  draftOutreach,
  type NicheKey,
} from "@/lib/prospect-scan";

const SCAN_CAP = 12; // businesses analyzed per scan run (keeps runs fast)

/** Run a discovery scan: geocode -> Overpass -> analyze -> upsert prospects. */
export async function runScan(formData: FormData): Promise<never> {
  await requireAdmin();
  const supabase = await createClient();

  const location = String(formData.get("location") ?? "").trim() || "Puyallup, WA";
  const radiusValue = Number(formData.get("radius_mi") ?? 10);
  const radiusMi = Number.isFinite(radiusValue) ? Math.max(1, Math.min(50, radiusValue)) : 10;
  const radiusM = Math.round(radiusMi * 1609.34);
  const niches = (formData.getAll("niches") as string[]).filter(
    (n): n is NicheKey => n in NICHES
  );
  if (!niches.length) redirect("/leads/discover?msg=" + encodeURIComponent("Pick at least one business type."));

  let geo: { lat: number; lng: number; label: string };
  try {
    geo = await geocode(location);
  } catch (e) {
    redirect("/leads/discover?msg=" + encodeURIComponent(e instanceof Error ? e.message : "Geocoding failed."));
  }
  const areaLabel = geo.label.split(",").slice(0, 2).join(",").trim();

  let found;
  try {
    found = await discoverBusinesses(geo.lat, geo.lng, radiusM, niches, SCAN_CAP * 2);
  } catch (e) {
    redirect("/leads/discover?msg=" + encodeURIComponent(e instanceof Error ? e.message : "Discovery failed."));
  }

  let inserted = 0;
  let skipped = 0;
  for (const b of found.slice(0, SCAN_CAP)) {
    const signals = await analyzeWebsite(b.website);
    const score = scoreSignals(signals);
    const row = {
      business_name: b.name,
      category: b.category,
      address: b.address,
      phone: b.phone,
      website: b.website,
      signals,
      opportunity_score: score,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Dedupe: same name (case-insensitive) already tracked?
    const { data: existing } = await supabase
      .from("prospects")
      .select("id")
      .ilike("business_name", b.name)
      .limit(1)
      .maybeSingle();
    const { error } = existing
      ? await supabase.from("prospects").update(row).eq("id", existing.id)
      : await supabase.from("prospects").insert(row);
    if (error) skipped++;
    else inserted++;
  }

  revalidatePath("/leads/discover");
  redirect(
    "/leads/discover?msg=" +
      encodeURIComponent(`Scanned ${areaLabel}: ${inserted} prospects saved${skipped ? `, ${skipped} skipped` : ""}.`)
  );
}

/** Re-run website analysis for one prospect. */
export async function analyzeProspect(id: string) {
  const { user } = await requireAdmin();
  void user;
  const supabase = await createClient();
  const { data: p } = await supabase.from("prospects").select("id, website").eq("id", id).single();
  if (!p) return;
  const signals = await analyzeWebsite(p.website);
  await supabase
    .from("prospects")
    .update({
      signals,
      opportunity_score: scoreSignals(signals),
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/leads/discover");
}

/** Generate (or regenerate) the outreach draft for one prospect. */
export async function generateDraft(id: string) {
  const { user } = await requireAdmin();
  void user;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("prospects")
    .select("id, business_name, category, website, signals")
    .eq("id", id)
    .single();
  if (!p) return;
  // Area label: best-effort from address, fallback generic.
  const { data: addr } = await supabase.from("prospects").select("address").eq("id", id).single();
  const areaLabel =
    (addr?.address ?? "").split(",").slice(-2).join(",").trim() || "the area";
  const { subject, body } = draftOutreach(
    {
      business_name: p.business_name,
      category: p.category ?? "business",
      address: null,
      phone: null,
      website: p.website,
      areaLabel,
    },
    p.signals
  );
  await supabase
    .from("prospects")
    .update({
      outreach_draft: `Subject: ${subject}\n\n${body}`,
      outreach_status: "drafted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/leads/discover");
}

/** Save an edited draft. */
export async function saveDraft(id: string, formData: FormData) {
  const { user } = await requireAdmin();
  void user;
  const text = String(formData.get("outreach_draft") ?? "").trim();
  const supabase = await createClient();
  await supabase
    .from("prospects")
    .update({
      outreach_draft: text || null,
      outreach_status: text ? "drafted" : "none",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/leads/discover");
}

/** Mark a draft as sent (manual — she sends it herself via Gmail). */
export async function markDraftSent(id: string) {
  const { user } = await requireAdmin();
  void user;
  const supabase = await createClient();
  await supabase
    .from("prospects")
    .update({ outreach_status: "sent", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/leads/discover");
}

/** Promote a prospect into a real Flowkeep lead. */
export async function promoteProspect(id: string) {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { data: p } = await supabase.from("prospects").select("*").eq("id", id).single();
  if (!p || p.status === "promoted") return;

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      business_name: p.business_name,
      phone: p.phone,
      website: p.website,
      acquisition_type: "outbound",
      momentum_state: "Waiting on Them",
      score: p.opportunity_score,
      status: "prospect",
      owner_id: user.id,
      metadata: {
        source: "prospect_scanner",
        prospect_id: p.id,
        category: p.category,
        signals: p.signals,
      },
    })
    .select("id")
    .single();
  if (error || !lead) return;

  await supabase
    .from("prospects")
    .update({ status: "promoted", lead_id: lead.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/leads/discover");
  revalidatePath("/leads");
}

/** Archive a prospect (not a fit, bad data, etc.). */
export async function archiveProspect(id: string) {
  const { user } = await requireAdmin();
  void user;
  const supabase = await createClient();
  await supabase
    .from("prospects")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/leads/discover");
}
