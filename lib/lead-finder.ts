import {
  NICHES, discoverBusinesses, geocode, normalizeSocialProfile,
  normalizeWebsite, socialProfilesFromTags,
  type DiscoveredBusiness, type NicheKey,
} from "./prospect-scan.ts";

export type FinderSource = "openstreetmap" | "geoapify";
export type FinderStatus = "queued" | "searching" | "complete" | "error";
export type FinderParams = {
  source: FinderSource;
  location: string;
  industry: string;
  niches: NicheKey[];
  radius_mi: number;
  result_limit: number;
  auto_import: boolean;
  top_count: number;
};

const GEOAPIFY_CATEGORIES: Record<NicheKey, string[]> = {
  restaurants: ["catering.restaurant"],
  bars: ["catering.bar", "catering.pub"],
  cafes: ["catering.cafe"],
  salons: ["service.beauty.hairdresser", "service.beauty"],
  contractors: ["service.carpenter", "service.electrician", "service.locksmith"],
  auto_repair: ["service.vehicle.repair.car"],
  fitness: ["sport.fitness.fitness_centre", "sport.fitness.gym"],
};

export function parseFinderForm(form: FormData): FinderParams {
  const source = form.get("source") === "geoapify" ? "geoapify" : "openstreetmap";
  const location = String(form.get("location") || "").trim();
  if (location.length < 2 || location.length > 200) throw new Error("Enter a valid city and state.");
  const categories = new Set(Object.keys(NICHES));
  const niches = [...new Set(form.getAll("niches").map(String))]
    .filter((k): k is NicheKey => categories.has(k));
  if (!niches.length) throw new Error("Select at least one business type.");
  const radius = Number(form.get("radius_mi"));
  const results = Number(form.get("result_limit"));
  const top = Number(form.get("top_count"));
  if (![radius, results, top].every(Number.isInteger) ||
      radius < 1 || radius > 50 ||
      results < 1 || results > 20 ||
      top < 1 || top > 10) throw new Error("Check the search radius and result limits.");
  return {
    source, location, niches, industry: niches.map(n => NICHES[n].label).join(", ").slice(0, 80),
    radius_mi: radius, result_limit: results,
    auto_import: form.get("auto_import") === "on", top_count: top,
  };
}

export function identityKey(sourceRef: string): string {
  return sourceRef.trim().toLowerCase();
}

export function websiteHost(raw: string | null | undefined): string | null {
  const safe = normalizeWebsite(raw || null);
  if (!safe) return null;
  try {
    const host = new URL(safe).hostname.toLowerCase().replace(/^www\./, "");
    if (["instagram.com", "facebook.com", "fb.com", "tiktok.com"].includes(host)) return null;
    return host || null;
  } catch { return null; }
}

export function isSameBusiness(
  a: { source_ref?: string | null; business_name?: string | null; website?: string | null; address?: string | null },
  b: { source_ref?: string | null; business_name?: string | null; website?: string | null; address?: string | null },
): boolean {
  if (a.source_ref && b.source_ref && identityKey(a.source_ref) === identityKey(b.source_ref)) return true;
  const ah = websiteHost(a.website), bh = websiteHost(b.website);
  if (ah && bh && ah === bh) return true;
  const name = (v: string | null | undefined) =>
    String(v || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  const addr = (v: string | null | undefined) =>
    String(v || "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  return Boolean(name(a.business_name) && name(a.business_name) === name(b.business_name)
    && addr(a.address) && addr(a.address) === addr(b.address));
}

export function completenessScore(b: Pick<DiscoveredBusiness, "website" | "phone" | "address"> &
  { email?: string | null; opening_hours?: string | null }): number {
  return Math.min(100, (websiteHost(b.website) ? 50 : 0) +
    (b.email ? 25 : 0) + (b.phone ? 15 : 0) + (b.address ? 5 : 0) +
    (b.opening_hours ? 5 : 0));
}

const osmType = (raw: unknown): string | null => {
  if (raw === "n" || raw === "node") return "node";
  if (raw === "w" || raw === "way") return "way";
  if (raw === "r" || raw === "relation") return "relation";
  return null;
};

export async function discoverGeoapify(
  lat: number, lng: number, radiusM: number,
  niches: NicheKey[], limit: number, key: string,
): Promise<DiscoveredBusiness[]> {
  const categories = [...new Set(niches.flatMap(n => GEOAPIFY_CATEGORIES[n]))];
  if (!categories.length) return [];
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  let response: Response;
  try {
    response = await fetch("https://api.geoapify.com/v2/places", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({
        categories,
        filter: { type: "circle", lon: lng, lat, radius: radiusM },
        bias: { type: "proximity", lon: lng, lat },
        limit: Math.min(20, Math.max(1, limit)),
      }),
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timeout); }
  if (!response.ok) throw new Error("Places provider is unavailable. Check its configuration or quota.");
  const body = (await response.json()) as {
    features?: Array<{
      properties?: {
        name?: string; place_id?: string; formatted?: string;
        phone?: string; website?: string; lat?: number; lon?: number;
        categories?: string[]; datasource?: { raw?: Record<string, unknown> };
      };
    }>;
  };
  if (!Array.isArray(body.features)) throw new Error("Places provider returned invalid results.");
  const found: DiscoveredBusiness[] = [];
  const seen = new Set<string>();
  for (const f of body.features) {
    const p = f.properties;
    if (!p?.name?.trim()) continue;
    const raw = p.datasource?.raw ?? {};
    const type = osmType(raw.osm_type);
    const osmId = String(raw.osm_id ?? "");
    const sourceRef = type && /^\d+$/.test(osmId) ? type + ":" + osmId :
      typeof p.place_id === "string" && /^[a-z0-9._~-]{8,240}$/i.test(p.place_id)
        ? "geoapify:" + p.place_id : null;
    if (!sourceRef || seen.has(sourceRef)) continue;
    seen.add(sourceRef);
    const tags = Object.fromEntries(
      Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
    const social = socialProfilesFromTags(tags);
    for (const platform of ["instagram", "facebook"] as const) {
      const value = tags["contact:" + platform] || tags[platform];
      const url = normalizeSocialProfile(value ?? null, platform);
      if (url && !social.some(p => p.url === url)) {
        social.push({ platform, url, source: "listing", status: "unconfirmed",
          evidence: "Public directory listing; verify this business profile." });
      }
    }
    found.push({
      source_ref: sourceRef,
      name: p.name.trim(),
      category: tags.amenity ?? tags.shop ?? tags.craft ?? tags.leisure ?? p.categories?.[0] ?? "business",
      address: typeof p.formatted === "string" ? p.formatted : null,
      phone: p.phone ?? tags.phone ?? tags["contact:phone"] ?? null,
      website: normalizeWebsite(p.website ?? tags.website ?? tags["contact:website"] ?? null),
      lat: typeof p.lat === "number" && Number.isFinite(p.lat) ? p.lat : null,
      lng: typeof p.lon === "number" && Number.isFinite(p.lon) ? p.lon : null,
      social_profiles: social,
    });
    if (found.length >= limit) break;
  }
  return found;
}

export async function geocodeGeoapify(place: string, key: string): Promise<{ lat: number; lng: number }> {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", place);
  url.searchParams.set("limit", "1");
  url.searchParams.set("format", "geojson");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "x-api-key": key, "Accept": "application/geo+json" },
      signal: ctrl.signal,
    });
  } finally { clearTimeout(timer); }
  if (!response.ok) throw new Error("Location lookup provider is unavailable. Please retry later.");
  const data = (await response.json()) as {
    features?: Array<{ properties?: { lat?: number; lon?: number } }>;
  };
  const p = data.features?.[0]?.properties;
  if (!p || typeof p.lat !== "number" || typeof p.lon !== "number" ||
    !Number.isFinite(p.lat) || !Number.isFinite(p.lon))
    throw new Error("No matching location found. Use a city and state.");
  return { lat: p.lat, lng: p.lon };
}

export async function findBusinesses(params: FinderParams): Promise<DiscoveredBusiness[]> {
  const radius = Math.round(params.radius_mi * 1609.34);
  if (params.source === "geoapify") {
    const key = process.env.GEOAPIFY_API_KEY?.trim();
    if (!key) throw new Error("Geoapify is not connected. Configure the private API key first.");
    // Fully independent of Nominatim/Overpass. Both calls use the same
    // private server-only credential, never a NEXT_PUBLIC_ variable.
    const { lat, lng } = await geocodeGeoapify(params.location, key);
    return discoverGeoapify(lat, lng, radius, params.niches, params.result_limit, key);
  }
  const { lat, lng } = await geocode(params.location);
  return discoverBusinesses(lat, lng, radius, params.niches, params.result_limit);
}
