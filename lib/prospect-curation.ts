// Prospect curation is a deterministic, side-effect-free comparator.
// "Reliability" means confidence in public evidence, not verified ownership.
// A strong redesign score is useful only after we have a contactable business.
import type { DiscoveredBusiness, NicheKey, WebsiteSignals } from "./prospect-scan";

export type ComparableProspect = {
  source_ref?: string | null;
  business_name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  signals?: Partial<WebsiteSignals> | null;
  opportunity_score?: number | null;
  status?: string | null;
  outreach_status?: string | null;
  outreach_draft?: string | null;
};

export type RatedProspect<T extends ComparableProspect = ComparableProspect> = {
  prospect: T;
  category: NicheKey | "other";
  reliability: number;
  opportunity: number;
  quality: number;
};

const CATEGORY_ALIASES: Record<NicheKey, string[]> = {
  restaurants: ["restaurant", "catering.restaurant"],
  bars: ["bar", "pub", "catering.bar", "catering.pub"],
  cafes: ["cafe", "catering.cafe"],
  salons: ["hairdresser", "beauty", "barber", "service.beauty", "service.beauty.hairdresser"],
  contractors: ["plumber", "electrician", "carpenter", "painter", "contractor", "service.carpenter", "service.electrician"],
  auto_repair: ["car_repair", "car", "service.vehicle.repair.car"],
  fitness: ["fitness_centre", "yoga", "sport.fitness.fitness_centre", "sport.fitness.gym"],
};

export function categoryBucket(category: string | null): NicheKey | "other" {
  const key = (category ?? "").toLowerCase().trim();
  return (Object.keys(CATEGORY_ALIASES) as NicheKey[])
    .find(group => CATEGORY_ALIASES[group].some(label => key === label || key.startsWith(label + "."))) ?? "other";
}

function matchedSocial(s: Partial<WebsiteSignals> | null | undefined): boolean {
  return Array.isArray(s?.social_profiles) &&
    s.social_profiles.some(p => p.status === "matched" && (p.platform === "instagram" || p.platform === "facebook"));
}

export function isContactable(p: ComparableProspect): boolean {
  // An unverified social link or a guessed missing website is not contact evidence.
  return Boolean(p.phone?.trim()) ||
    Boolean(p.website?.trim() && p.signals?.reachable) ||
    matchedSocial(p.signals);
}

export function reliabilityScore(p: ComparableProspect): number {
  let score = p.business_name.trim() ? 10 : 0;
  if (p.source_ref && /^(node|way|relation):\d+$|^geoapify:[a-z0-9_-]{8,200}$/i.test(p.source_ref)) score += 10;
  if (p.address?.trim()) score += 15; // Listed address, not independently verified.
  if (p.phone?.trim()) score += 25; // Listed phone, not independently verified.
  if (p.website?.trim()) score += p.signals?.reachable ? 25 : 5;
  if (matchedSocial(p.signals)) score += 15; // A matching social page is stronger evidence.
  return Math.min(100, score);
}

export function rateProspect<T extends ComparableProspect>(p: T): RatedProspect<T> {
  const reliability = reliabilityScore(p);
  const opportunity = Math.max(0, Math.min(100,
    typeof p.opportunity_score === "number" && Number.isFinite(p.opportunity_score) ? p.opportunity_score : 0,
  ));
  return {
    prospect: p,
    category: categoryBucket(p.category),
    reliability,
    opportunity,
    quality: Math.round(reliability * 0.7 + opportunity * 0.3),
  };
}

export function protectedFromScannerUpdate(p: ComparableProspect): boolean {
  return p.status === "promoted" ||
    p.status === "archived" ||
    p.outreach_status === "sent" ||
    p.outreach_status === "drafted" ||
    Boolean(p.outreach_draft?.trim());
}

function precheckValue(p: DiscoveredBusiness): number {
  return (p.address ? 20 : 0) + (p.phone ? 35 : 0) +
    (p.website ? 30 : 0) + (p.social_profiles.length ? 12 : 0) +
    (p.lat !== null && p.lng !== null ? 5 : 0);
}

/** Inspect likely-contactable listings first and rotate across requested niches. */
export function prioritizeDiscovered(
  discovered: DiscoveredBusiness[], niches: NicheKey[], analyzeLimit: number,
): DiscoveredBusiness[] {
  const groups = [...new Set(niches)];
  const seen = new Set<string>();
  const buckets = new Map(groups.map(g => [g, [] as DiscoveredBusiness[]]));
  const uncategorized: DiscoveredBusiness[] = [];
  for (const p of [...discovered].sort((a, b) => precheckValue(b) - precheckValue(a))) {
    if (!p.name.trim() || !p.source_ref || seen.has(p.source_ref)) continue;
    seen.add(p.source_ref);
    const key = categoryBucket(p.category);
    if (key !== "other" && buckets.has(key)) buckets.get(key)!.push(p);
    else uncategorized.push(p);
  }
  const result: DiscoveredBusiness[] = [];
  const capped = Math.max(0, Math.min(30, Math.floor(analyzeLimit)));
  while (result.length < capped && groups.some(g => buckets.get(g)!.length)) {
    for (const g of groups) {
      const next = buckets.get(g)!.shift();
      if (next) result.push(next);
      if (result.length >= capped) break;
    }
  }
  return result.concat(uncategorized, ...groups.map(g => buckets.get(g)!)).slice(0, capped);
}

export type ExistingLead = {
  business_name: string;
  website?: string | null;
  phone?: string | null;
  metadata?: { category?: string | null } | null;
};

function normalizedComparable(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/** Prevent re-importing an already booked/contacted Lead as a new prospect.
 * Require same name plus exact public website or phone within a compatible niche.
 * Names by themselves never establish duplicate identity.
 */
export function matchesExistingLead(p: ComparableProspect, leads: ExistingLead[]): boolean {
  const name = normalizedComparable(p.business_name);
  const phone = normalPhone(p.phone);
  const website = normalizedComparable(p.website).replace(/\/+$/, "");
  const niche = categoryBucket(p.category);
  return leads.some(lead => {
    if (normalizedComparable(lead.business_name) !== name) return false;
    const leadNiche = categoryBucket(lead.metadata?.category ?? null);
    if (leadNiche !== "other" && niche !== "other" && leadNiche !== niche) return false;
    const samePhone = Boolean(phone && phone === normalPhone(lead.phone));
    const sameWebsite = Boolean(website && website === normalizedComparable(lead.website).replace(/\/+$/, ""));
    return sameWebsite || samePhone;
  });
}

export type CuratedSelection<T extends ComparableProspect> = {
  winners: Array<RatedProspect<T> & { compared: number; nextBest: number | null; existingId: string | null }>;
  rejected: number;
  protectedCount: number;
};

/**
 * Compare new candidates to existing prospects of the same category.
 * Previous prospects are NEVER archived, deleted or demoted automatically.
 * The rolling top-N benchmark decides which new discoveries are worth saving.
 */
export function curateProspects<T extends ComparableProspect>(
  incoming: T[],
  previous: Array<ComparableProspect & { id: string }>,
  limit = 12,
  perCategoryBenchmark = 12,
): CuratedSelection<T> {
  const roster = new Map<NicheKey | "other", number[]>();
  for (const prev of previous) {
    if (prev.status === "archived" || prev.status === "promoted") continue;
    const rated = rateProspect(prev);
    const values = roster.get(rated.category) ?? [];
    values.push(rated.quality);
    roster.set(rated.category, values);
  }
  const winners: CuratedSelection<T>["winners"] = [];
  let rejected = 0;
  let protectedCount = 0;
  const candidates = incoming.map(rateProspect).sort((a, b) =>
    b.quality - a.quality || b.reliability - a.reliability || a.prospect.business_name.localeCompare(b.prospect.business_name)
  );
  const identities = new Set<string>();
  for (const entry of candidates) {
    const p = entry.prospect;
    if (winners.length >= limit) break;
    if (!p.source_ref || identities.has(p.source_ref)) { rejected++; continue; }
    identities.add(p.source_ref);
    // Prefer stable discovery IDs. A name alone never establishes identity.
    const same = previous.filter(old => old.source_ref && old.source_ref === p.source_ref);
    if (same.some(protectedFromScannerUpdate)) { protectedCount++; continue; }
    const existing = same.length === 1 ? same[0] : null;
    // A repeat scan must not degrade previously gathered evidence if the
    // website or socials are temporarily unreachable on this attempt.
    if (existing && entry.quality < rateProspect(existing).quality) {
      rejected++;
      continue;
    }
    const compared = previous.filter(old => categoryBucket(old.category) === entry.category && old.status !== "archived");
    const scores = roster.get(entry.category) ?? [];
    const sorted = [...scores].sort((a, b) => b - a);
    const threshold = sorted[Math.min(perCategoryBenchmark, sorted.length) - 1] ?? null;
    if (!isContactable(p) || entry.reliability < 45 ||
      (!existing && sorted.length >= perCategoryBenchmark && threshold !== null && entry.quality <= threshold + 4)) {
      rejected++;
      continue;
    }
    winners.push({ ...entry, compared: compared.length, nextBest: threshold, existingId: existing?.id ?? null });
    if (!existing) {
      scores.push(entry.quality);
      roster.set(entry.category, scores);
    }
  }
  return { winners, rejected, protectedCount };
}
