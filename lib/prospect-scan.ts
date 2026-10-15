// Prospect Scanner — automatic business discovery + website analysis + outreach drafts.
//
// $0 stack, no API keys, deterministic (no LLM):
//   discovery  -> OpenStreetMap Overpass API (businesses by category + radius)
//   geocoding  -> Nominatim (place name -> lat/lng)
//   analysis   -> direct HTTP fetch + HTML signal extraction
//   scoring    -> deterministic 0-100 from redesign signals
//   outreach   -> deterministic draft templates in Hailey's voice (never auto-sent)
//
// Nothing here sends email or messages. Drafts are for her review only.

export type NicheKey =
  | "restaurants"
  | "bars"
  | "cafes"
  | "salons"
  | "contractors"
  | "auto_repair"
  | "fitness";

export const NICHES: Record<NicheKey, { label: string; overpass: string[] }> = {
  restaurants: { label: "Restaurants", overpass: ['nwr["amenity"="restaurant"]'] },
  bars: { label: "Bars & Pubs", overpass: ['nwr["amenity"="bar"]', 'nwr["amenity"="pub"]'] },
  cafes: { label: "Cafes & Coffee", overpass: ['nwr["amenity"="cafe"]'] },
  salons: {
    label: "Salons & Barbers",
    overpass: ['nwr["shop"="hairdresser"]', 'nwr["shop"="beauty"]', 'nwr["shop"="barber"]'],
  },
  contractors: {
    label: "Contractors & Trades",
    overpass: [
      'nwr["craft"="plumber"]',
      'nwr["craft"="electrician"]',
      'nwr["craft"="carpenter"]',
      'nwr["craft"="painter"]',
      'nwr["office"="contractor"]',
    ],
  },
  auto_repair: { label: "Auto Repair", overpass: ['nwr["shop"="car_repair"]', 'nwr["shop"="car"]'] },
  fitness: {
    label: "Gyms & Fitness",
    overpass: ['nwr["leisure"="fitness_centre"]', 'nwr["sport"="yoga"]'],
  },
};

export type DiscoveredBusiness = {
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};

export type WebsiteSignals = {
  has_website: boolean;
  reachable: boolean;
  https: boolean;
  mobile_viewport: boolean;
  builder: string | null;
  title_ok: boolean;
  description_ok: boolean;
  stale_copyright: boolean;
  copyright_year: number | null;
  load_ms: number | null;
  page_bytes: number | null;
  error?: string;
};

const UA = "NinthHeartStudios-OS/1.0 (prospect-scanner; contact: admin@ninthheartstudios.com)";

async function fetchWithTimeout(url: string, ms: number, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

/** Nominatim: "Puyallup, WA" -> { lat, lng }. Free, no key. */
export async function geocode(place: string): Promise<{ lat: number; lng: number; label: string }> {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(place)}&format=json&limit=1&countrycodes=us`;
  const res = await fetchWithTimeout(url, 10000, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Geocode failed: HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!rows.length) throw new Error(`No location found for "${place}"`);
  return { lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), label: rows[0].display_name };
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Overpass: businesses of the given niches within radius meters of a point. */
export async function discoverBusinesses(
  lat: number,
  lng: number,
  radiusM: number,
  niches: NicheKey[],
  limit = 40
): Promise<DiscoveredBusiness[]> {
  const filters = niches.flatMap((n) =>
    NICHES[n].overpass.map((f) => `  ${f}(around:${radiusM},${lat},${lng});`)
  );
  const query = `[out:json][timeout:25];\n(\n${filters.join("\n")}\n);\nout center ${limit};`;
  const res = await fetchWithTimeout("https://overpass-api.de/api/interpreter", 30000, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass failed: HTTP ${res.status}`);
  const data = (await res.json()) as { elements?: OverpassElement[] };
  const out: DiscoveredBusiness[] = [];
  const seen = new Set<string>();
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const category =
      tags.amenity ?? tags.shop ?? tags.craft ?? tags.leisure ?? tags.office ?? "business";
    const addrParts = [
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:city"],
      tags["addr:state"],
      tags["addr:postcode"],
    ].filter(Boolean);
    out.push({
      name,
      category,
      address: addrParts.length ? addrParts.join(", ") : null,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      website: normalizeWebsite(tags.website ?? tags["contact:website"] ?? null),
      lat: el.lat ?? el.center?.lat ?? null,
      lng: el.lon ?? el.center?.lon ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function normalizeWebsite(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

const BUILDER_MARKERS: Array<{ key: string; label: string; patterns: RegExp[] }> = [
  { key: "wix", label: "Wix", patterns: [/wix\.com/i, /generator["']\s*content=["'][^"']*wix/i] },
  { key: "squarespace", label: "Squarespace", patterns: [/squarespace/i] },
  { key: "weebly", label: "Weebly", patterns: [/weebly/i] },
  { key: "godaddy", label: "GoDaddy", patterns: [/godaddy/i, /websitebuilder/i] },
  { key: "duda", label: "Duda", patterns: [/\bduda/i] },
  {
    key: "wordpress",
    label: "WordPress",
    patterns: [/wp-content/i, /generator["']\s*content=["'][^"']*wordpress/i],
  },
];

/** Fetch a site and extract redesign signals. Never throws — returns error in signals. */
export async function analyzeWebsite(rawUrl: string | null): Promise<WebsiteSignals> {
  const empty: WebsiteSignals = {
    has_website: false,
    reachable: false,
    https: false,
    mobile_viewport: false,
    builder: null,
    title_ok: false,
    description_ok: false,
    stale_copyright: false,
    copyright_year: null,
    load_ms: null,
    page_bytes: null,
  };
  const url = normalizeWebsite(rawUrl);
  if (!url) return empty;
  empty.has_website = true;

  const candidates = [url];
  if (url.startsWith("https://")) candidates.push(url.replace("https://", "http://"));

  for (const candidate of candidates) {
    try {
      const start = Date.now();
      const res = await fetchWithTimeout(
        candidate,
        9000,
        { headers: { "User-Agent": UA, Accept: "text/html" } }
      );
      const load_ms = Date.now() - start;
      const ctype = res.headers.get("content-type") ?? "";
      if (!res.ok || !ctype.includes("text/html")) continue;
      const text = await res.text();
      if (text.length > 1_500_000) continue; // skip monsters

      const builder =
        BUILDER_MARKERS.find((b) => b.patterns.some((p) => p.test(text)))?.label ?? null;
      const titleMatch = text.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
      const copyrightMatch = text.match(/(?:©|&copy;|\bcopyright\b)[^0-9]{0,10}(19|20)\d{2}/i);
      const yearMatch = copyrightMatch?.[0].match(/(19|20)\d{2}/);
      const copyright_year = yearMatch ? parseInt(yearMatch[0], 10) : null;
      const currentYear = new Date().getFullYear();

      return {
        has_website: true,
        reachable: true,
        https: candidate.startsWith("https://"),
        mobile_viewport: /<meta[^>]+name=["']viewport["']/i.test(text),
        builder,
        title_ok: !!(titleMatch?.[1].trim()) && !/untitled|home\s*$/i.test(titleMatch[1].trim()),
        description_ok: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(text),
        stale_copyright: copyright_year !== null && copyright_year < currentYear - 1,
        copyright_year,
        load_ms,
        page_bytes: text.length,
      };
    } catch {
      continue;
    }
  }
  return { ...empty, error: "unreachable" };
}

/** Deterministic 0-100 opportunity score. Higher = better outreach target. */
export function scoreSignals(s: WebsiteSignals): number {
  if (!s.has_website) return 35; // No URL listed is not proof of no website.
  if (!s.reachable) return 25; // A temporary check failure is inconclusive.
  let score = 5;
  if (!s.https) score += 12;
  if (!s.mobile_viewport) score += 18;
  if (s.builder && ["Wix", "Weebly", "GoDaddy", "Duda"].includes(s.builder)) score += 15;
  else if (s.builder === "WordPress") score += 5;
  if (!s.title_ok) score += 8;
  if (!s.description_ok) score += 7;
  if (s.stale_copyright) score += 5;
  if (s.load_ms !== null && s.load_ms > 3000) score += 5;
  return Math.min(100, score);
}

export type ProspectInput = {
  business_name: string;
  category: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  areaLabel: string;
};

/** Deterministic outreach draft in Hailey's voice. Never sent automatically. */
export function draftOutreach(p: ProspectInput, s: WebsiteSignals): { subject: string; body: string } {
  const catWord =
    p.category === "restaurant" ? "restaurants"
    : p.category === "bar" || p.category === "pub" ? "bars"
    : p.category === "hairdresser" || p.category === "beauty" ? "salons"
    : "local businesses";

  const findings: string[] = [];
  if (!s.has_website) {
    findings.push(
      `you don't seem to have a website at all right now — which means people searching for ${catWord} in ${p.areaLabel} aren't finding you.`
    );
  } else {
    if (!s.reachable) findings.push(`your site wouldn't load when I checked it.`);
    if (!s.mobile_viewport) findings.push(`it doesn't display properly on phones — and most of your customers check you out on mobile first.`);
    if (s.builder && ["Wix", "Weebly", "GoDaddy", "Duda"].includes(s.builder))
      findings.push(`it's built on ${s.builder}, which tends to look dated and load slowly next to a custom build.`);
    if (!s.https) findings.push(`it's not running on HTTPS, which browsers now flag as "not secure" to visitors.`);
    if (s.stale_copyright && s.copyright_year)
      findings.push(`the copyright still says ${s.copyright_year}, which makes the whole place look closed even when it isn't.`);
    if (!s.title_ok || !s.description_ok)
      findings.push(`it's missing the basics Google needs to show you properly in search results.`);
  }
  if (!findings.length) findings.push(`there's a gap between how good the business is and what the website says about it.`);

  const subject = `Quick thought on ${p.business_name}'s website`;
  const body = [
    `Hi ${p.business_name} team —`,
    ``,
    `I'm Hailey, a web designer based near ${p.areaLabel}. I was looking at ${p.business_name} and noticed ${findings.join(" ")}`,
    ``,
    `I build custom websites for ${catWord} — no templates, no page-builder look, just a site that actually brings in business. I offer a free 15-minute consultation if you want a straight answer on what I'd change and what it'd cost.`,
    ``,
    `Worth a conversation?`,
    ``,
    `— Hailey`,
    `Ninth Heart Studios`,
    `ninthheartstudios.com`,
  ].join("\n");

  return { subject, body };
}

/** Human-readable signal badges for the UI. */
export function signalBadges(s: WebsiteSignals): Array<{ label: string; tone: "good" | "warn" | "bad" }> {
  const badges: Array<{ label: string; tone: "good" | "warn" | "bad" }> = [];
  if (!s.has_website) return [{ label: "No website listed (verify)", tone: "warn" }];
  if (!s.reachable) return [{ label: "Website check inconclusive", tone: "warn" }];
  badges.push(s.https ? { label: "HTTPS", tone: "good" } : { label: "No HTTPS", tone: "warn" });
  badges.push(
    s.mobile_viewport ? { label: "Viewport tag set", tone: "good" } : { label: "Viewport tag missing", tone: "warn" }
  );
  if (s.builder) badges.push({ label: `Built on ${s.builder}`, tone: "good" });
  if (s.stale_copyright) badges.push({ label: `Stale © ${s.copyright_year}`, tone: "warn" });
  if (!s.title_ok || !s.description_ok) badges.push({ label: "Metadata to review", tone: "warn" });
  if (s.load_ms !== null && s.load_ms > 3000) badges.push({ label: "Slow load", tone: "warn" });
  return badges;
}
