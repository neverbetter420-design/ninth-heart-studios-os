"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deriveNewLead } from "@/lib/flowkeep";
import { prioritizeDiscovered, curateProspects, protectedFromScannerUpdate, rateProspect, type ComparableProspect } from "@/lib/prospect-curation";
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

const SCAN_CAP = 12; // bounded website/social analysis; search a much larger candidate pool
const DISCOVERY_POOL = 72;

/** Run a discovery scan: geocode -> Geoapify/Overpass -> analyze -> save prospects. */
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

  // The deployed Worker already has GEOAPIFY_API_KEY as a secret binding.
  // Read it only during the admin-only server action; never serialize to UI.
  let geoapifyKey = process.env.GEOAPIFY_API_KEY;
  try {
    const workerEnv = getCloudflareContext().env as { GEOAPIFY_API_KEY?: string };
    geoapifyKey = workerEnv.GEOAPIFY_API_KEY || geoapifyKey;
  } catch {
    // Local Next.js dev and test environments may not have Cloudflare context.
  }
  let found;
  try {
    found = await discoverBusinesses(geo.lat, geo.lng, radiusM, niches, DISCOVERY_POOL, geoapifyKey);
  } catch (e) {
    redirect("/leads/discover?msg=" + encodeURIComponent(e instanceof Error ? e.message : "Discovery failed."));
  }

  // Fail closed if we cannot read saved prospects. Otherwise a database
  // outage could be mistaken for an empty category and accept poor leads.
  const { data: history, error: historyError } = await supabase.from("prospects")
    .select("id, source_ref, business_name, category, address, phone, website, signals, opportunity_score, status, outreach_status, outreach_draft")
    .limit(1000);
  if (historyError || !history || history.length >= 1000) {
    redirect("/leads/discover?msg=" + encodeURIComponent(
      "Could not safely compare existing prospects. No new prospects saved."
    ));
  }
  const previous = history as Array<ComparableProspect & { id: string }>;

  // Rotate through the chosen niches and inspect the listings with the most
  // useful public contact clues first. A listing alone isn't "verified".
  const toAnalyze = prioritizeDiscovered(found, niches, SCAN_CAP);
  const analyzed: Array<ComparableProspect & { source_ref: string }> = [];
  for (let i = 0; i < toAnalyze.length; i += 3) {
    const checked = await Promise.all(toAnalyze.slice(i, i + 3).map(async (b) => {
      try {
        const { signals, website } = await analyzeBusinessPresence(b);
        return {
          source_ref: b.source_ref,
          business_name: b.name,
          category: b.category,
          address: b.address,
          phone: b.phone,
          website,
          signals,
          opportunity_score: scoreSignals(signals),
          status: "new",
          outreach_status: "none",
        };
      } catch {
        return null; // An unreachable site or profile must not halt the scan.
      }
    }));
    for (const prospect of checked) if (prospect) analyzed.push(prospect);
  }

  // Prefer contactable businesses, comparing both evidence reliability and
  // redesign opportunity against existing records in the same niche.
  const selected = curateProspects(analyzed, previous, SCAN_CAP);
  let created = 0;
  let refreshed = 0;
  let skipped = 0;
  for (const candidate of selected.winners) {
    const b = candidate.prospect;
    // Only backfill an unindexed legacy record with a name PLUS exact website
    // or address match, and never modify a prospect with outreach history.
    const legacyMatches = previous.filter(p =>
      !p.source_ref && p.business_name === b.business_name &&
      ((b.website && p.website === b.website) || (b.address && p.address === b.address))
    );
    if (legacyMatches.some(protectedFromScannerUpdate)) { skipped++; continue; }
    const legacy = legacyMatches.length === 1 ? legacyMatches[0] : null;
    const existingId = candidate.existingId ?? legacy?.id ?? null;
    if (legacyMatches.length > 1 && !candidate.existingId) { skipped++; continue; }
    if (legacy && candidate.quality < rateProspect(legacy).quality) { skipped++; continue; }

    const row = {
      source_ref: b.source_ref,
      business_name: b.business_name,
      category: b.category,
      address: b.address,
      phone: b.phone,
      website: b.website,
      signals: {
        ...b.signals,
        curation: {
          reliability: candidate.reliability,
          opportunity: candidate.opportunity,
          quality: candidate.quality,
          compared_to: candidate.compared,
          summary: "Selected using public contact evidence and site opportunity; review before outreach",
        },
      },
      opportunity_score: b.opportunity_score,
      scanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const outcome = existingId
      ? await supabase.from("prospects").update(row)
          .eq("id", existingId).eq("status", "new").eq("outreach_status", "none")
          .select("id")
      : await supabase.from("prospects").insert(row).select("id");
    if (outcome.error || outcome.data?.length !== 1) skipped++;
    else if (existingId) refreshed++;
    else created++;
  }

  revalidatePath("/leads/discover");
  const message =
    `Scanned ${areaLabel}: ${created} stronger new prospect${created === 1 ? "" : "s"} saved, ${refreshed} existing refreshed, ${selected.rejected} lower-confidence candidates held back` +
    (selected.protectedCount ? `, ${selected.protectedCount} outreach-protected` : "") +
    (skipped ? `, ${skipped} save conflicts` : "") + ".";
  redirect("/leads/discover?msg=" + encodeURIComponent(message) + "&sort=recent");
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
