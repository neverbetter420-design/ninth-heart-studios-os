// Read-only challenger shortlists. Saved prospects remain intact: only the
// recommended order changes as evidence improves.
import { isContactable, protectedFromScannerUpdate, rateProspect, type ComparableProspect } from "./prospect-curation.ts";
import type { NicheKey } from "./prospect-scan.ts";

export type SavedChallenger = ComparableProspect & {
  id: string;
  scanned_at?: string | null;
};
export type RankedChallenger = {
  id: string;
  business_name: string;
  category: NicheKey;
  reliability: number;
  opportunity: number;
  quality: number;
  rank: number;
  has_phone: boolean;
  has_reachable_site: boolean;
  has_matched_social: boolean;
};
export type ChallengerGroup = {
  category: NicheKey;
  qualified: number;
  considered: number;
  top: RankedChallenger[];
};

const NICHE_ORDER: NicheKey[] = [
  "restaurants", "bars", "cafes", "salons", "contractors", "auto_repair", "fitness",
];

// Only owner-visible, bounded display sizes. Unknown URL params default to 3;
// there is no request to fetch extra records, send outreach or modify rankings.
export type ShortlistDepth = 3 | 10 | 20;
export const SHORTLIST_DEPTHS: readonly ShortlistDepth[] = [3, 10, 20];
export function parseShortlistDepth(value: unknown): ShortlistDepth {
  return value === "10" ? 10 : value === "20" ? 20 : 3;
}

export function buildChallengerShortlists(
  prospects: SavedChallenger[],
  topPerCategory = 3,
): ChallengerGroup[] {
  const maxTop = Math.max(1, Math.min(20, Math.floor(topPerCategory)));
  const groups = new Map<NicheKey, { considered: number; candidates: RankedChallenger[] }>(
    NICHE_ORDER.map(n => [n, { considered: 0, candidates: [] }]),
  );
  const seen = new Set<string>();
  for (const p of prospects) {
    const rated = rateProspect(p);
    if (rated.category === "other" || p.status !== "new" ||
      protectedFromScannerUpdate(p)) continue;
    const group = groups.get(rated.category)!;
    group.considered++;
    if (!isContactable(p) || rated.reliability < 45) continue;
    // Stable place identity prevents showing the same business twice.
    // A name-only match is never enough to merge two physical locations.
    const identity = p.source_ref ? "ref:" + p.source_ref : "row:" + p.id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    group.candidates.push({
      id: p.id,
      business_name: p.business_name,
      category: rated.category,
      reliability: rated.reliability,
      opportunity: rated.opportunity,
      quality: rated.quality,
      rank: 0,
      has_phone: Boolean(p.phone?.trim()),
      has_reachable_site: Boolean(p.website?.trim() && p.signals?.reachable),
      has_matched_social: Boolean(p.signals?.social_profiles?.some(
        s => s.status === "matched" && ["facebook", "instagram"].includes(s.platform))),
    });
  }
  return NICHE_ORDER.map(category => {
    const group = groups.get(category)!;
    group.candidates.sort((a, b) =>
      b.quality - a.quality || b.reliability - a.reliability ||
      a.business_name.localeCompare(b.business_name) || a.id.localeCompare(b.id),
    );
    return {
      category,
      considered: group.considered,
      qualified: group.candidates.length,
      top: group.candidates.slice(0, maxTop).map((candidate, index) => ({
        ...candidate, rank: index + 1,
      })),
    };
  }).filter(group => group.considered > 0);
}
