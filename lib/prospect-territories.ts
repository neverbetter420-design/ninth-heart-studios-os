// Read-only territorial comparison of the SAVED PROSPECT SAMPLE.
// The search center is not proof that a business is located within that city.
// Never treat this as full business coverage, territory saturation, or sales ROI.
import { isContactable, protectedFromScannerUpdate, rateProspect, type ComparableProspect } from "./prospect-curation.ts";
import type { NicheKey, WebsiteSignals } from "./prospect-scan.ts";

const NICHE_KEYS: NicheKey[] = [
  "restaurants", "bars", "cafes", "salons", "contractors", "auto_repair", "fitness",
];
export type ScanTerritory = {
  version: 1;
  location: string; // Owner-entered search location; NOT a business address.
  area_label: string; // Geocoder's search area display label.
  radius_mi: number;
  niches: NicheKey[];
  checked_at: string;
};
export type TerritoryProspect = ComparableProspect & {
  id: string;
  scanned_at?: string | null;
  signals?: Partial<WebsiteSignals> | null;
};
export type TerritorySummary = {
  location: string;
  area_label: string;
  radius_mi: number;
  niches: NicheKey[];
  saved: number;
  qualified: number;
  average_quality: number | null;
  best_quality: number | null;
  latest_checked_at: string;
  top_categories: Array<{ category: NicheKey; count: number }>;
};
export type TerritoryComparison = {
  areas: TerritorySummary[];
  with_context: number;
  without_context: number;
};

function normalizeTerritory(value: ScanTerritory | null | undefined): ScanTerritory | null {
  if (!value || value.version !== 1 || typeof value.location !== "string" ||
    typeof value.area_label !== "string" || typeof value.checked_at !== "string" ||
    !Number.isInteger(value.radius_mi) || value.radius_mi < 1 || value.radius_mi > 50 ||
    value.location.trim().length < 2 || value.location.length > 160 ||
    value.area_label.trim().length < 2 || value.area_label.length > 160 ||
    !Array.isArray(value.niches)) return null;
  const niches = [...new Set(value.niches.filter(n => NICHE_KEYS.includes(n)))];
  if (!niches.length || !Number.isFinite(Date.parse(value.checked_at))) return null;
  return { version: 1, location: value.location.trim(), area_label: value.area_label.trim(),
    radius_mi: value.radius_mi, niches, checked_at: value.checked_at };
}
export function createScanTerritory(
  location: string, areaLabel: string, radiusMi: number, niches: NicheKey[], checkedAt: string,
): ScanTerritory {
  const value = normalizeTerritory({
    version: 1, location: location.slice(0, 160), area_label: areaLabel.slice(0, 160),
    radius_mi: Math.round(radiusMi), niches, checked_at: checkedAt,
  });
  if (!value) throw new Error("Invalid territory context; no new prospect should be saved.");
  return value;
}
function key(t: ScanTerritory) {
  return t.location.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ") + "\u0000" + t.radius_mi;
}
/** All counts refer only to the bounded, complete saved prospect read from DB.
 * Do not compare against a 60-row visible page or invent market penetration.
 */
export function compareSavedTerritories(prospects: TerritoryProspect[], maxAreas = 6): TerritoryComparison {
  const groups = new Map<string, {
    territory: ScanTerritory;
    rows: TerritoryProspect[];
    indices: Map<string, number>;
  }>();
  let without_context = 0, with_context = 0;
  for (const p of prospects) {
    const ctx = normalizeTerritory(p.signals?.scan_territory);
    if (!ctx) { without_context++; continue; }
    with_context++;
    const k = key(ctx);
    const bucket = groups.get(k) ?? { territory: ctx, rows: [] as TerritoryProspect[], indices: new Map<string, number>() };
    // Provider source IDs identify listings across repeated scans. A matching
    // business NAME is not unique, especially for franchise locations.
    const id = p.source_ref ? "source:" + p.source_ref : "row:" + p.id;
    const previousIndex = bucket.indices.get(id);
    if (previousIndex === undefined) {
      bucket.indices.set(id, bucket.rows.length);
      bucket.rows.push(p);
    } else {
      // In an anomalous duplicated saved source, any contacted/protected copy
      // takes precedence over an uncontacted one. Never count it as qualified.
      const old = bucket.rows[previousIndex];
      const oldProtected = old.status !== "new" || protectedFromScannerUpdate(old);
      const newProtected = p.status !== "new" || protectedFromScannerUpdate(p);
      if ((newProtected && !oldProtected) ||
        (newProtected === oldProtected && rateProspect(p).quality > rateProspect(old).quality)) {
        bucket.rows[previousIndex] = p;
      }
    }
    if (Date.parse(ctx.checked_at) > Date.parse(bucket.territory.checked_at)) {
      bucket.territory = ctx;
    }
    groups.set(k, bucket);
  }
  const areas: TerritorySummary[] = [];
  for (const group of groups.values()) {
    const qualifying = group.rows.map(rateProspect).filter(r =>
      r.prospect.status === "new" && !protectedFromScannerUpdate(r.prospect) &&
      r.category !== "other" && isContactable(r.prospect) && r.reliability >= 45
    );
    const categoryCount = new Map<NicheKey, number>();
    for (const rated of qualifying) {
      const category = rated.category as NicheKey;
      categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
    }
    const top_categories = [...categoryCount].map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || NICHE_KEYS.indexOf(a.category) - NICHE_KEYS.indexOf(b.category))
      .slice(0, 3);
    const quality = qualifying.map(r => r.quality);
    areas.push({
      location: group.territory.location, area_label: group.territory.area_label,
      radius_mi: group.territory.radius_mi, niches: group.territory.niches,
      saved: group.rows.length, qualified: qualifying.length,
      average_quality: quality.length ? Math.round(quality.reduce((a, b) => a + b, 0) / quality.length) : null,
      best_quality: quality.length ? Math.max(...quality) : null,
      latest_checked_at: group.territory.checked_at, top_categories,
    });
  }
  areas.sort((a, b) => b.qualified - a.qualified ||
    (b.average_quality ?? -1) - (a.average_quality ?? -1) ||
    b.saved - a.saved || a.location.localeCompare(b.location) || a.radius_mi - b.radius_mi);
  const cap = Number.isInteger(maxAreas) ? Math.max(1, Math.min(12, maxAreas)) : 6;
  return { areas: areas.slice(0, cap), with_context, without_context };
}
