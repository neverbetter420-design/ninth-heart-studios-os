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
  source_ref: string;
  name: string;
  category: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  social_profiles: SocialProfile[];
};

export type SocialPlatform = "instagram" | "facebook";
export type SocialProfile = {
  platform: SocialPlatform;
  url: string;
  source: "listing" | "website" | "manual";
  status: "matched" | "unconfirmed";
  evidence: string;
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
  social_profiles?: SocialProfile[];
  social_checked_at?: string;
  website_source?: "listing" | "social_profile";
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
  let res: Response;
  try {
    res = await fetchWithTimeout(url, 10000, { headers: { "User-Agent": UA } });
  } catch {
    throw new Error("Location lookup is temporarily unavailable. Try again with a city and state.");
  }
  if (!res.ok) throw new Error(`Location lookup failed (HTTP ${res.status}). Please try again later.`);
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
  // Public Overpass instances occasionally throttle or time out. Try a second
  // independent provider once, sequentially, without multiplying API traffic.
  // These endpoints are fixed, never user-controlled (avoid SSRF).
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ] as const;
  let data: { elements?: OverpassElement[] } | null = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetchWithTimeout(endpoint, 12000, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue; // Another provider may be available on 429/5xx.
      const parsed = (await res.json()) as { elements?: OverpassElement[] };
      if (!Array.isArray(parsed?.elements)) continue;
      data = parsed;
      break;
    } catch {
      // A timed-out or unreachable provider must not abort the entire scan.
    }
  }
  if (!data) {
    throw new Error("Business directory is busy or unreachable. Try again shortly, or use a smaller radius.");
  }
  const out: DiscoveredBusiness[] = [];
  const seen = new Set<string>();
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = (tags.name ?? "").trim();
    const source_ref = `${el.type}:${el.id}`;
    if (!name || seen.has(source_ref)) continue;
    seen.add(source_ref);
    const category =
      tags.amenity ?? tags.shop ?? tags.craft ?? tags.leisure ?? tags.office ?? "business";
    const addrParts = [
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:city"],
      tags["addr:state"],
      tags["addr:postcode"],
    ].filter(Boolean);
    out.push({
      source_ref,
      name,
      category,
      address: addrParts.length ? addrParts.join(", ") : null,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      website: normalizeWebsite(tags.website ?? tags["contact:website"] ?? null),
      lat: el.lat ?? el.center?.lat ?? null,
      lng: el.lon ?? el.center?.lon ?? null,
      social_profiles: socialProfilesFromTags(tags),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Exact platform hosts only: reject share/login/post links and lookalike domains. */
export function normalizeSocialProfile(raw: string | null, platform?: SocialPlatform): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const value = raw.trim();
  const handle = value.replace(/^@/, "");
  const candidate = platform && /^[a-z0-9._-]{1,100}$/i.test(handle) && !/^(?:www\.)?(instagram|facebook)\.com$/i.test(handle)
    ? `https://www.${platform}.com/${handle}/` : normalizeWebsite(value);
  if (!candidate) return null;
  const url = new URL(candidate);
  const inferred = socialPlatform(url.toString());
  if (!inferred || (platform && inferred !== platform)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (!parts.length) return null;
  if (inferred === "instagram") {
    if (parts.length !== 1 || !/^[a-z0-9._]{1,30}$/i.test(parts[0]) || /^(accounts|explore|p|reel|reels|stories|direct|about|developer|web|legal)$/i.test(parts[0])) return null;
  } else {
    if (/^(login|login.php|checkpoint|share|sharer|sharer.php|dialog|watch|reel|reels|groups|events|plugins|help|privacy|policies|l.php)$/i.test(parts[0])) return null;
    if (parts[0] === "profile.php") {
      const id = url.searchParams.get("id");
      return id && /^\d+$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
    }
    if (parts.length !== 1 && !(["pages", "people"].includes(parts[0]) && parts.length === 3 && /^\d+$/.test(parts[2]))) return null;
    if (parts.some(p => !/^[a-z0-9._-]+$/i.test(p))) return null;
  }
  return `https://www.${inferred}.com/${parts.join("/")}/`;
}

function socialPlatform(raw: string): SocialPlatform | null {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (["instagram.com", "www.instagram.com", "m.instagram.com"].includes(host)) return "instagram";
    if (["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"].includes(host)) return "facebook";
  } catch { /* invalid links are not candidates */ }
  return null;
}

export function socialProfilesFromTags(tags: Record<string, string>): SocialProfile[] {
  const profiles: SocialProfile[] = [];
  for (const platform of ["instagram", "facebook"] as const) {
    const url = normalizeSocialProfile(tags[`contact:${platform}`] ?? tags[platform] ?? null, platform);
    if (url) profiles.push({ platform, url, source: "listing", status: "unconfirmed", evidence: "Listed business profile; not checked yet" });
  }
  const website = normalizeSocialProfile(tags.website ?? tags["contact:website"] ?? null);
  if (website && !profiles.some(p => p.url === website)) profiles.push({ platform: socialPlatform(website)!, url: website, source: "listing", status: "unconfirmed", evidence: "Listed as the business website; not checked yet" });
  return profiles;
}

/** Refresh the same OSM object, never a similarly named business or location. */
export async function refreshSocialProfiles(sourceRef: string | null): Promise<SocialProfile[]> {
  const identity = /^(node|way|relation):(\d+)$/.exec(sourceRef ?? "");
  if (!identity) return [];
  try {
    const res = await fetchWithTimeout("https://overpass-api.de/api/interpreter", 7000, {
      method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(`[out:json][timeout:5];${identity[1]}(${identity[2]});out tags;`)}`,
    });
    if (!res.ok) return [];
    const data = await res.json() as { elements?: OverpassElement[] };
    const element = data.elements?.find(e => `${e.type}:${e.id}` === sourceRef);
    return socialProfilesFromTags(element?.tags ?? {});
  } catch { return []; }
}

/** Validate untrusted third-party website links before any server request. */
export function normalizeWebsite(raw: string | null): string | null {
  if (!raw || !raw.trim() || raw.length > 2048) return null;
  try {
    const text = raw.trim();
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || (url.port && !["80", "443"].includes(url.port))) return null;
    // IP literals, internal DNS names, and public wildcard DNS to local addresses
    // are not valid prospect website targets.
    if (!hostname.includes(".") || hostname.includes(":")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;
    if (/(^|\.)(local|localhost|internal|lan|test|invalid|example)$/.test(hostname)) return null;
    if (/(^|\.)(nip\.io|sslip\.io|localhost\.direct|home\.arpa)$/.test(hostname)) return null;
    if (hostname.length > 253) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}


/** Validate every redirect hop rather than implicitly following arbitrary URLs. */
async function fetchPublicSite(rawUrl: string): Promise<Response> {
  let current = normalizeWebsite(rawUrl);
  if (!current) throw new Error("Unsafe website URL");
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(7000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || redirects === 3) throw new Error("Redirect limit exceeded");
    current = normalizeWebsite(new URL(location, current).toString());
    if (!current) throw new Error("Unsafe website redirect");
  }
  throw new Error("Too many redirects");
}

/** Never buffer unlimited HTML from a remote website. */
async function readLimitedHtml(response: Response): Promise<{ text: string; bytes: number }> {
  if (!response.body) throw new Error("Empty response");
  if (Number(response.headers.get("content-length")) > 1_500_000) throw new Error("Website page too large");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 1_500_000) throw new Error("Website page too large");
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return { text, bytes };
  } finally {
    await reader.cancel().catch(() => {});
  }
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
  if (!rawUrl) return empty;
  empty.has_website = true;
  const url = normalizeWebsite(rawUrl);
  if (!url) return { ...empty, error: "unsafe_url" };

  try {
      const start = Date.now();
      const res = await fetchPublicSite(url);
      const load_ms = Date.now() - start;
      const ctype = res.headers.get("content-type") ?? "";
      if (!res.ok || !ctype.toLowerCase().includes("text/html")) {
        return { ...empty, error: "unavailable_or_non_html" };
      }
      const { text, bytes } = await readLimitedHtml(res);

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
        https: res.url.startsWith("https://"),
        mobile_viewport: /<meta[^>]+name=["']viewport["']/i.test(text),
        builder,
        title_ok: !!(titleMatch?.[1].trim()) && !/untitled|home\s*$/i.test(titleMatch[1].trim()),
        description_ok: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(text),
        stale_copyright: copyright_year !== null && copyright_year < currentYear - 1,
        copyright_year,
        load_ms,
        page_bytes: bytes,
        social_profiles: socialProfilesFromHtml(text),
      };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "unreachable" };
  }
}

function decodeHtml(text: string): string {
  return text.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#(?:39|x27);|&apos;/gi, "'").replace(/&nbsp;/gi, " ");
}

function attribute(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"))?.[2] ?? null;
}

function socialProfilesFromHtml(html: string): SocialProfile[] {
  const profiles: SocialProfile[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>/gi)) {
    const url = normalizeSocialProfile(decodeHtml(attribute(match[0], "href") ?? ""));
    if (url && !profiles.some(p => p.platform === socialPlatform(url))) profiles.push({ platform: socialPlatform(url)!, url, source: "website", status: "unconfirmed", evidence: "Linked from the business website; not checked yet" });
  }
  return profiles;
}

type PresenceInput = {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  social_profiles?: SocialProfile[];
};

function words(raw: string): string {
  return decodeHtml(raw).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** A public profile must match the name AND phone/location before it can supply a website. */
async function checkSocialProfile(profile: SocialProfile, business: PresenceInput): Promise<{ profile: SocialProfile; websites: string[] }> {
  const unconfirmed = (evidence: string) => ({ profile: { ...profile, status: "unconfirmed" as const, evidence }, websites: [] as string[] });
  const url = normalizeSocialProfile(profile.url, profile.platform);
  if (!url) return unconfirmed("Invalid profile link; manual review required");
  try {
    let current = url;
    const signal = AbortSignal.timeout(4500);
    let response: Response | null = null;
    for (let hop = 0; hop <= 2; hop++) {
      response = await fetch(current, { redirect: "manual", headers: { "User-Agent": UA, Accept: "text/html" }, signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || hop === 2) return unconfirmed("Profile redirects could not be verified");
      const next = normalizeSocialProfile(new URL(location, current).toString(), profile.platform);
      if (!next) return unconfirmed("Profile requires login or redirects away; manual review required");
      current = next;
    }
    if (!response?.ok || !(response.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) return unconfirmed("Public profile unavailable; manual review required");
    const { text } = await readLimitedHtml(response);
    // Only visible content and description/title metadata count as identity evidence.
    // Script bundles can contain unrelated businesses, so never search them for a match.
    const visible = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    const metadata = [...visible.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).filter(tag => /^(og:title|og:description|description)$/i.test(attribute(tag, "name") ?? attribute(tag, "property") ?? "")).map(tag => attribute(tag, "content") ?? "").join(" ");
    const readable = decodeHtml(metadata + " " + visible.replace(/<[^>]*>/g, " "));
    const title = decodeHtml(visible.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
    if (/^(?:instagram|facebook|log\s*in.*|.*login.*|security check|just a moment.*)$/i.test(title.trim()) || /content (?:isn't|is not) available|sorry,? this page isn't available|please wait a few minutes/i.test(readable)) return unconfirmed("Login, unavailable page or automated-access block; manual review required");
    const name = words(business.name);
    const content = ` ${words(readable)} `;
    const profileTitle = [...visible.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).filter(tag => attribute(tag, "property")?.toLowerCase() === "og:title").map(tag => attribute(tag, "content") ?? "").join(" ");
    const nameMatch = name.length >= 4 && ` ${words(title + " " + profileTitle)} `.includes(` ${name} `);
    const phone = business.phone?.replace(/\D/g, "").slice(-10) ?? "";
    const phoneMatch = phone.length === 10 && [...readable.matchAll(/\+?\d[\d\s().-]{7,}\d/g)].some(m => m[0].replace(/\D/g, "").slice(-10) === phone);
    // Discovery addresses are street, city, state, postcode; require a street or city.
    const addressParts = (business.address ?? "").split(",").map(words);
    const locationMatch = addressParts.some((part, i) => i < 2 && part.length >= 4 && !/^[a-z]{2}$|^\d+$/.test(part) && content.includes(` ${part} `));
    if (!nameMatch || !(phoneMatch || locationMatch)) return unconfirmed("Could not match the business name and phone/location; review this profile");

    const websites = new Set<string>();
    // Only explicit website/identity links count. Links in posts, adverts or
    // unrelated embedded JSON must never replace the business website.
    const links: string[] = [];
    for (const match of visible.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
      const label = words(attribute(match[0], "aria-label") ?? match[0].replace(/<[^>]*>/g, " "));
      const rel = (attribute(match[0], "rel") ?? "").split(/\s+/);
      if (!/^(?:(?:visit|official|business|our) )?(?:our )?website(?: link)?$/.test(label) && !rel.includes("me")) continue;
      links.push(decodeHtml(attribute(match[0], "href") ?? ""));
    }
    for (const raw of links) {
      let target = normalizeWebsite(raw);
      if (!target) continue;
      const parsed = new URL(target);
      if (["l.facebook.com", "lm.facebook.com", "l.instagram.com"].includes(parsed.hostname)) target = normalizeWebsite(parsed.searchParams.get("u"));
      if (!target) continue;
      const host = new URL(target).hostname.toLowerCase();
      if (/(^|\.)(facebook\.com|instagram\.com|meta\.com|fb\.com|fbcdn\.net|cdninstagram\.com|threads\.net|threads\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com|google\.com|apple\.com|microsoft\.com|linktr\.ee|yelp\.com|doordash\.com|ubereats\.com|opentable\.com|resy\.com|toasttab\.com|squareup\.com|bit\.ly|goo\.gl)$/.test(host)) continue;
      websites.add(target);
    }
    return { profile: { ...profile, url: current, status: "matched", evidence: phoneMatch ? "Public profile matches business name and phone" : "Public profile matches business name and location" }, websites: [...websites] };
  } catch { return unconfirmed("Public profile check inconclusive; manual review required"); }
}

/** Check up to one Instagram and one Facebook profile; absence is never proven. */
export async function analyzeBusinessPresence(business: PresenceInput): Promise<{ website: string | null; signals: WebsiteSignals }> {
  const listedWebsite = normalizeWebsite(business.website);
  let website = listedWebsite && !socialPlatform(listedWebsite) ? listedWebsite : null;
  let signals = await analyzeWebsite(website);
  const profiles = [...(signals.social_profiles ?? []), ...(business.social_profiles ?? [])];
  const listedSocial = normalizeSocialProfile(listedWebsite);
  if (listedSocial) profiles.unshift({ platform: socialPlatform(listedSocial)!, url: listedSocial, source: "listing", status: "unconfirmed", evidence: "Listed as business website" });
  const candidates = new Map<SocialPlatform, SocialProfile>();
  for (const p of profiles) {
    const url = normalizeSocialProfile(p.url, p.platform);
    if (url && ["instagram", "facebook"].includes(p.platform) && !candidates.has(p.platform)) candidates.set(p.platform, { ...p, url });
  }
  const checked = await Promise.all([...candidates.values()].map(p => checkSocialProfile(p, business)));
  if (!website) {
    const websites = [...new Set(checked.flatMap(p => p.websites))];
    // Conflicting links require human review. Do not choose an arbitrary business URL.
    if (websites.length === 1) {
      website = websites[0];
      signals = { ...await analyzeWebsite(website), website_source: "social_profile" };
    }
  }
  return { website, signals: { ...signals, social_profiles: checked.map(p => p.profile), social_checked_at: new Date().toISOString() } };
}

/** Deterministic 0-100 opportunity score. Higher = better outreach target. */
export function scoreSignals(s: WebsiteSignals): number {
  if (!s.has_website) return 10; // Unverified absence stays low priority, even with a social profile.
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
    findings.push(s.social_profiles?.some(p => p.status === "matched")
      ? "I found your business on social media, but couldn't confirm a separate website from the listing and public profile check. If you already have one, I'd love to take a look."
      : "I couldn't find a website linked in the business listing. Your website and social profiles still need a closer look before I draw any conclusions.");
  } else if (!s.reachable) {
    findings.push("I couldn't verify the website during a quick check, so I won't guess at what's wrong.");
  } else {
    if (!s.mobile_viewport) findings.push("I noticed a missing viewport tag, which is worth testing on an actual phone.");
    if (!s.https) findings.push("The page was served over HTTP rather than HTTPS.");
    if (s.stale_copyright && s.copyright_year) findings.push(`The page still displays a ${s.copyright_year} copyright year.`);
    if (!s.title_ok) findings.push("The page title could use another look.");
    if (!s.description_ok) findings.push("I didn't find a standard meta description in the HTML checked.");
  }
  if (!findings.length) findings.push("I'd be happy to offer a fresh perspective on your website.");

  const subject = `Quick thought on ${p.business_name}'s website`;
  const body = [
    `Hi ${p.business_name} team —`,
    ``,
    `I'm Hailey with Ninth Heart Studios. I was reviewing businesses around ${p.areaLabel}. ${findings.join(" ")}`,
    ``,
    `I design websites for ${catWord}, with clear mobile layouts and an easier path for customers. I offer a free 15-minute consultation if you'd like a second opinion and realistic options.`,
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
  if (!s.has_website) return [{ label: "Website unconfirmed · low priority", tone: "warn" }];
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
