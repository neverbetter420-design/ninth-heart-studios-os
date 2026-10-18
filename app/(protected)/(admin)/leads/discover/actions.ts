"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deriveNewLead } from "@/lib/flowkeep";
import {
  NICHES,
  geocode,
  discoverBusinesses,
  analyzeBusinessPresence,
  refreshSocialProfiles,
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
  for (let i = 0; i < Math.min(found.length, SCAN_CAP); i += 3) {
    await Promise.all(found.slice(i, i + 3).map(async (b) => {
    const { signals, website } = await analyzeBusinessPresence(b);
    const score = scoreSignals(signals);
    const row = {
      source_ref: b.source_ref,
      business_name: b.name,
      category: b.category,
      address: b.address,
      phone: b.phone,
      website,
      signals,
      opportunity_score: score,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Prefer stable OSM element identity, never overwrite a different
    // location merely because two businesses share a name.
    const { data: known } = await supabase.from("prospects")
      .select("id").eq("source_ref", b.source_ref).maybeSingle();
    let existingId: string | null = known?.id ?? null;

    // Backfill legacy pre-identity records only with an additional exact
    // website or street-address match; name by itself is insufficient.
    if (!existingId && (b.address || b.website)) {
      const { data: candidates } = await supabase.from("prospects")
        .select("id, address, website").eq("business_name", b.name).is("source_ref", null).limit(20);
      const matching = (candidates ?? []).filter((p) =>
        Boolean((b.website && p.website === b.website) || (b.address && p.address === b.address))
      );
      if (matching.length === 1) existingId = matching[0].id;
    }
    const { error } = existingId
      ? await supabase.from("prospects").update(row).eq("id", existingId)
      : await supabase.from("prospects").insert(row);
    if (error) skipped++;
    else inserted++;
    }));
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
  const { data: p } = await supabase.from("prospects").select("id, source_ref, business_name, website, address, phone, signals").eq("id", id).single();
  if (!p) return;
  const refreshed = await refreshSocialProfiles(p.source_ref);
  const { signals, website } = await analyzeBusinessPresence({
    name: p.business_name, website: p.website, address: p.address, phone: p.phone,
    social_profiles: [...refreshed, ...(p.signals?.social_profiles ?? [])],
  });
  await supabase
    .from("prospects")
    .update({
      signals,
      website,
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
  if (!p || p.status === "promoted" || p.lead_id) return;

  const wasSent = p.outreach_status === "sent";
  const initial = deriveNewLead({ acquisitionType: "outbound", hasContactMethod: false });
  const workflow = wasSent
    ? { momentum_state: "Waiting on Them", next_action: "Follow up when appropriate", next_action_kind: "follow_up", last_activity_at: new Date().toISOString() }
    : { ...initial, next_action: "Find business email" };

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      business_name: p.business_name,
      phone: p.phone,
      website: p.website,
      acquisition_type: "outbound",
      ...workflow,
      score: typeof p.signals?.has_website === "boolean" ? scoreSignals(p.signals) : p.opportunity_score,
      status: wasSent ? "contacted" : "prospect",
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
