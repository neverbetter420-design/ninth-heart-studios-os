"use server";

// Deep scans run in six-business, owner-invoked batches. The database holds
// progress between requests; no Cloudflare request waits for 100 web audits.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { discoverBusinesses, geocode, NICHES, analyzeBusinessPresence,
  scoreSignals, type NicheKey, type DiscoveredBusiness } from "@/lib/prospect-scan";
import { validDeepSize, nextDeepScanBatch } from "@/lib/deep-scan";
import { prioritizeDiscovered, curateProspects, protectedFromScannerUpdate,
  rateProspect, matchesExistingLead, type ComparableProspect, type ExistingLead } from "@/lib/prospect-curation";

const BATCH_SIZE = 6; // must match DB finish_deep_scan_batch upper bound
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const redirectWithMessage = (message: string): never =>
  redirect("/leads/discover?msg=" + encodeURIComponent(message));

type DeepJob = {
  id: string;
  lease_token: string | null;
  status: string;
  position: number;
  requested: number;
  candidates: DiscoveredBusiness[];
};

function geoapifySecret(): string | undefined {
  let key = process.env.GEOAPIFY_API_KEY;
  try {
    const env = getCloudflareContext().env as { GEOAPIFY_API_KEY?: string };
    key = env.GEOAPIFY_API_KEY || key;
  } catch { /* local Next.js development */ }
  return key;
}

function validBusiness(raw: unknown): raw is DiscoveredBusiness {
  if (!raw || typeof raw !== "object") return false;
  const b = raw as Record<string, unknown>;
  return typeof b.source_ref === "string" && b.source_ref.length > 0 &&
    typeof b.name === "string" && b.name.length > 0 &&
    typeof b.category === "string" &&
    (b.address === null || typeof b.address === "string") &&
    (b.website === null || typeof b.website === "string") &&
    (b.phone === null || typeof b.phone === "string") &&
    Array.isArray(b.social_profiles);
}

/** Start and persist a one-time discovery snapshot. No website audits yet. */
export async function createDeepScan(formData: FormData): Promise<never> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const location = String(formData.get("location") ?? "").trim();
  const radiusMi = Number(formData.get("radius_mi"));
  const requested = Number(formData.get("deep_size"));
  const niches = [...new Set(formData.getAll("niches").map(String))]
    .filter((n): n is NicheKey => Object.prototype.hasOwnProperty.call(NICHES, n));
  if (location.length < 2 || location.length > 160 || ![5, 10, 15, 25].includes(radiusMi) ||
    !validDeepSize(requested) || niches.length === 0) {
    return redirectWithMessage("Choose a valid location, radius, scan size and at least one category.");
  }

  let businesses: DiscoveredBusiness[] = [];
  let areaLabel = location;
  try {
    const geo = await geocode(location);
    areaLabel = geo.label.split(",").slice(0, 2).join(",").trim().slice(0, 160);
    const found = await discoverBusinesses(geo.lat, geo.lng, Math.round(radiusMi * 1609.34),
      niches, requested, geoapifySecret());
    businesses = prioritizeDiscovered(found, niches, requested).filter(validBusiness);
  } catch (err) {
    return redirectWithMessage("Deep Scan discovery could not start: " +
      (err instanceof Error ? err.message.slice(0, 140) : "provider unavailable") + ".");
  }
  if (!businesses.length) return redirectWithMessage("No directory candidates were found. Nothing was saved.");

  const { data, error } = await supabase.from("deep_scan_jobs").insert({
    created_by: user.id, location, area_label: areaLabel!,
    radius_m: Math.round(radiusMi * 1609.34), niches, requested,
    candidates: businesses, status: "ready",
  }).select("id").single();
  if (error || !data?.id) return redirectWithMessage(
    "Deep Scan could not save its queue. Verify the reviewed database migration is installed.");
  revalidatePath("/leads/discover");
  return redirectWithMessage(`Deep Scan created: ${businesses.length} candidates queued for ${requested} requested. Use Process next batch to begin.`);
}

/** A single atomic lease + bounded 6-candidate analysis + committed progress. */
export async function processDeepScanBatch(formData: FormData): Promise<never> {
  await requireAdmin();
  const id = String(formData.get("job_id") ?? "");
  if (!UUID.test(id)) return redirectWithMessage("Invalid Deep Scan ID.");
  const supabase = await createClient();
  const { data: claimed, error: claimError } = await supabase.rpc("claim_deep_scan_batch", { p_id: id }).maybeSingle();
  const job = claimed as DeepJob | null;
  if (claimError || !job) return redirectWithMessage(
    "That scan is paused, already processing, complete, or the Deep Scan migration is unavailable.");
  const lease = job.lease_token;
  if (!lease || !Array.isArray(job.candidates) || !Number.isInteger(job.position)) {
    return redirectWithMessage("Scan queue is invalid. No processing was started.");
  }

  const batch = nextDeepScanBatch(job.candidates, job.position);
  let created = 0;
  let refreshed = 0;
  let conflicts = 0;
  try {
    if (!batch.length || batch.some(b => !validBusiness(b))) throw new Error("Corrupted saved candidate batch.");
    const { data: history, error: historyError } = await supabase.from("prospects")
      .select("id, source_ref, business_name, category, address, phone, website, signals, opportunity_score, status, outreach_status, outreach_draft")
      .limit(1000);
    const { data: leads, error: leadsError } = await supabase.from("leads")
      .select("business_name, website, phone, metadata").limit(1000);
    if (historyError || leadsError || !history || !leads || history.length >= 1000 || leads.length >= 1000) {
      throw new Error("Existing lead/prospect comparisons are unavailable or exceed the review limit.");
    }
    const previous = history as Array<ComparableProspect & { id: string }>;
    const existingLeads = leads as unknown as ExistingLead[];
    const analyzed: Array<ComparableProspect & { source_ref: string }> = [];
    for (let offset = 0; offset < batch.length; offset += 3) {
      const checked = await Promise.all(batch.slice(offset, offset + 3).map(async b => {
        try {
          const { signals, website } = await analyzeBusinessPresence(b);
          return {
            source_ref: b.source_ref, business_name: b.name,
            category: b.category, address: b.address, phone: b.phone, website, signals,
            opportunity_score: scoreSignals(signals),
            status: "new", outreach_status: "none",
          };
        } catch { return null; }
      }));
      for (const result of checked) if (result) analyzed.push(result);
    }
    const notAlreadyLeads = analyzed.filter(p => !matchesExistingLead(p, existingLeads));
    const curated = curateProspects(notAlreadyLeads, previous, BATCH_SIZE);
    for (const entry of curated.winners) {
      const b = entry.prospect;
      const legacyMatches = previous.filter(p =>
        !p.source_ref && p.business_name === b.business_name &&
        ((b.website && p.website === b.website) || (b.address && p.address === b.address)));
      if (legacyMatches.some(protectedFromScannerUpdate) ||
        (!entry.existingId && legacyMatches.length > 1)) { conflicts++; continue; }
      const legacy = legacyMatches.length === 1 ? legacyMatches[0] : null;
      if (legacy && entry.quality < rateProspect(legacy).quality) { conflicts++; continue; }
      const existingId = entry.existingId ?? legacy?.id ?? null;
      const row = {
        source_ref: b.source_ref, business_name: b.business_name,
        category: b.category, address: b.address, phone: b.phone, website: b.website,
        signals: { ...b.signals, curation: {
          reliability: entry.reliability, opportunity: entry.opportunity,
          quality: entry.quality, compared_to: entry.compared,
          summary: "Selected using public contact evidence and site opportunity; review before outreach",
        }},
        opportunity_score: b.opportunity_score, scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const result = existingId
        ? await supabase.from("prospects").update(row).eq("id", existingId)
            .eq("status", "new").eq("outreach_status", "none").is("outreach_draft", null).select("id")
        : await supabase.from("prospects").insert(row).select("id");
      if (result.error || result.data?.length !== 1) conflicts++;
      else if (existingId) refreshed++;
      else created++;
    }
    const held = batch.length - created - refreshed - conflicts;
    const { data: finished, error: finishError } = await supabase.rpc("finish_deep_scan_batch", {
      p_id: id, p_lease: lease, p_processed: batch.length,
      p_created: created, p_refreshed: refreshed, p_held: held, p_conflicts: conflicts,
    }).maybeSingle();
    if (finishError || !finished) throw new Error(
      "Batch completion could not be recorded; retry after the lease expires (stable IDs prevent duplicates).");
    revalidatePath("/leads/discover");
    const progress = finished as DeepJob;
    return redirectWithMessage(`Deep Scan batch saved: ${batch.length} checked, ${created} new, ${refreshed} refreshed, ${held} held, ${conflicts} conflicts. ${progress.position} of ${progress.candidates.length} processed.`);
  } catch (err) {
    // Next.js redirect() is an exception: let it through unaltered.
    if (err && typeof err === "object" && "digest" in err &&
      String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) throw err;
    const message = err instanceof Error ? err.message.slice(0, 240) : "Batch processing failed";
    await supabase.rpc("pause_deep_scan_batch", { p_id: id, p_lease: lease, p_error: message });
    return redirectWithMessage("Deep Scan paused safely: " + message);
  }
}

/** Owner-only pause / resume / cancel between batches. */
export async function changeDeepScanStatus(formData: FormData): Promise<never> {
  const { user } = await requireAdmin();
  const id = String(formData.get("job_id") ?? "");
  const operation = String(formData.get("operation") ?? "");
  if (!UUID.test(id) || !["pause", "resume", "cancel"].includes(operation))
    return redirectWithMessage("Invalid Deep Scan action.");
  const supabase = await createClient();
  const from = operation === "resume" ? "paused" : "ready";
  const target = operation === "pause" ? "paused" : operation === "cancel" ? "cancelled" : "ready";
  const { data, error } = await supabase.from("deep_scan_jobs")
    .update({ status: target, updated_at: new Date().toISOString(), last_error: null })
    .eq("id", id).eq("created_by", user.id).eq("status", from).select("id");
  if (error || data?.length !== 1)
    return redirectWithMessage("Scan status was not changed. It may already be processing or finished.");
  revalidatePath("/leads/discover");
  return redirectWithMessage(`Deep Scan ${target}.`);
}
