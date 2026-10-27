// Prospect Scanner verification: scoring, badges, drafts, URL normalization.
// No database, no network.
import assert from "node:assert/strict";
import {
  NICHES,
  discoverBusinesses,
  analyzeBusinessPresence,
  normalizeSocialProfile,
  refreshSocialProfiles,
  normalizeWebsite,
  scoreSignals,
  signalBadges,
  draftOutreach,
  type WebsiteSignals,
} from "../lib/prospect-scan.ts";

const base: WebsiteSignals = {
  has_website: true,
  reachable: true,
  https: true,
  mobile_viewport: true,
  builder: null,
  title_ok: true,
  description_ok: true,
  stale_copyright: false,
  copyright_year: 2026,
  load_ms: 800,
  page_bytes: 40000,
};

// 1. Niches cover her client types
assert.ok("restaurants" in NICHES && "salons" in NICHES && "contractors" in NICHES, "niches present");
for (const [k, v] of Object.entries(NICHES)) {
  assert.ok(v.label && v.overpass.length > 0, `niche ${k} has label + filters`);
}

// 2. URL normalization
assert.equal(normalizeWebsite(null), null);
assert.equal(normalizeWebsite("  "), null);
assert.equal(normalizeWebsite("example.com"), "https://example.com/");
assert.equal(normalizeWebsite("http://example.com"), "http://example.com/");

// 3. Unsafe inputs cannot cause backend fetches to local services.
for (const unsafe of [
  "http://127.0.0.1/",
  "http://192.168.0.1/",
  "http://[::1]/",
  "http://localhost/",
  "http://printer.local/",
  "http://127.0.0.1.nip.io/",
  "https://user:password@example.com/",
  "https://example.com:8080/",
  "file:///etc/passwd",
]) assert.equal(normalizeWebsite(unsafe), null, `blocked: ${unsafe}`);

// 4. Missing website evidence is deliberately low priority.
assert.equal(scoreSignals({ ...base, has_website: false }), 10, "unverified absence → 10");
assert.equal(scoreSignals({ ...base, reachable: false }), 25, "inconclusive check → 25");
const clean = scoreSignals(base);
assert.ok(clean < 20, `clean site scores low (got ${clean})`);
const rough = scoreSignals({
  ...base,
  https: false,
  mobile_viewport: false,
  builder: "Wix",
  title_ok: false,
  stale_copyright: true,
});
assert.ok(rough > clean, "rough site outscores clean site");
assert.ok(scoreSignals({ ...base, https: false, mobile_viewport: false, builder: "Wix", title_ok: false, description_ok: false, stale_copyright: true, load_ms: 5000 }) <= 100, "capped at 100");

// 4. Badges reflect signals
const noSite = signalBadges({ ...base, has_website: false });
assert.equal(noSite.length, 1);
assert.equal(noSite[0].label, "Website unconfirmed · low priority");
const bad = signalBadges({ ...base, https: false, mobile_viewport: false, builder: "Wix" });
assert.ok(bad.some((b) => b.label === "No HTTPS"), "https badge");
assert.ok(bad.some((b) => b.label === "Viewport tag missing"), "viewport badge");
assert.ok(bad.some((b) => b.label === "Built on Wix"), "builder badge");

// 5. Drafts: personalized, her voice, never empty
const draft = draftOutreach(
  { business_name: "Copper Kettle", category: "restaurant", address: null, phone: null, website: "http://x.com", areaLabel: "Puyallup, WA" },
  { ...base, mobile_viewport: false }
);
assert.ok(draft.subject.includes("Copper Kettle"), "subject names the business");
assert.ok(draft.body.includes("Hailey"), "signed by Hailey");
assert.ok(draft.body.includes("15-minute consultation"), "has CTA");
assert.ok(draft.body.toLowerCase().includes("mobile"), "references the finding");
const noSiteDraft = draftOutreach(
  { business_name: "No Site Diner", category: "restaurant", address: null, phone: null, website: null, areaLabel: "Puyallup, WA" },
  { ...base, has_website: false }
);
assert.ok(noSiteDraft.body.includes("couldn't find a website linked"), "no-website finding");

// Business names are not unique IDs. Two locations with one name must survive.
const previousFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({ elements: [
    { type: "node", id: 101, tags: { name: "Shared Name", amenity: "bar", "contact:instagram": "@sharedbar", "contact:facebook": "https://facebook.com/sharedbar" } },
    { type: "way", id: 202, tags: { name: "Shared Name", amenity: "bar" } },
    { type: "node", id: 101, tags: { name: "Shared Name", amenity: "bar" } },
  ] }), { status: 200, headers: { "content-type": "application/json" } });
  const found = await discoverBusinesses(47.1, -122.3, 2000, ["bars"], 12);
  assert.equal(found.length, 2, "different OSM objects are not collapsed by name");
  assert.deepEqual(found.map((b) => b.source_ref), ["node:101", "way:202"]);
  assert.equal(found[0].social_profiles.length, 2, "discovery retains both social contact tags");
} finally {
  globalThis.fetch = previousFetch;
}

// Social profiles are distinct from independent websites and cannot point at arbitrary hosts.
assert.equal(normalizeSocialProfile("@copperkettle", "instagram"), "https://www.instagram.com/copperkettle/");
assert.equal(normalizeSocialProfile("https://m.facebook.com/profile.php?id=123&ref=tracking"), "https://www.facebook.com/profile.php?id=123");
for (const invalid of ["https://instagram.com.evil.com/copper/", "https://instagram.com@evil.com/copper/", "https://facebook.com/login/", "https://facebook.com/sharer.php?u=https://local", "https://instagram.com/p/123/", "http://127.0.0.1/profile", "https://www.instagram.com:8080/copper/"]) {
  assert.equal(normalizeSocialProfile(invalid), null, `invalid social target: ${invalid}`);
}

const business = { name: "Copper Kettle", address: "123 Main St, Puyallup, WA, 98371", phone: "253-555-0123", website: null };
const facebook = { platform: "facebook" as const, url: "https://www.facebook.com/copperkettle/", source: "listing" as const, status: "unconfirmed" as const, evidence: "Listed" };
const instagram = { ...facebook, platform: "instagram" as const, url: "https://www.instagram.com/copperkettle/" };
const cleanHtml = '<title>Copper Kettle — Local dining</title><meta name="viewport" content="width=device-width"><meta name="description" content="Independent local dining in Puyallup">';
function htmlResponse(html: string, url: string) {
  const res = new Response(html, { headers: { "content-type": "text/html" } });
  Object.defineProperty(res, "url", { value: url });
  return res;
}
let calls: string[] = [];
async function withFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>, run: () => Promise<void>) {
  calls = [];
  globalThis.fetch = async (url, init) => { calls.push(String(url)); return respond(String(url), init); };
  try { await run(); } finally { globalThis.fetch = previousFetch; }
}

await withFetch(() => { throw new Error("Unexpected network call"); }, async () => {
  const result = await analyzeBusinessPresence(business);
  assert.equal(scoreSignals(result.signals), 10);
  assert.deepEqual(result.signals.social_profiles, []);
  assert.equal(calls.length, 0, "do not guess social handles or claim absence was verified");
});

await withFetch(url => htmlResponse('<title>Copper Kettle | Facebook</title><p>Copper Kettle · (253) 555-0123</p><a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fcopperkettle.com%2F">Website</a>', url), async () => {
  // Distinguish the profile from a website; a reachable Facebook page is never audited as a business site.
  const result = await analyzeBusinessPresence({ ...business, website: facebook.url });
  assert.equal(result.signals.social_profiles?.[0].status, "matched");
  assert.equal(result.website, "https://copperkettle.com/");
  assert.equal(result.signals.website_source, "social_profile");
  assert.deepEqual(calls, [facebook.url, "https://copperkettle.com/"]);
});

await withFetch(url => htmlResponse('<title>Copper Kettle (@copperkettle) · Instagram</title><p>Copper Kettle, Puyallup</p>', url), async () => {
  const result = await analyzeBusinessPresence({ ...business, social_profiles: [instagram] });
  assert.equal(result.signals.social_profiles?.[0].status, "matched");
  assert.equal(result.website, null);
  assert.equal(scoreSignals(result.signals), 10, "social presence does not raise a missing-website priority");
  assert.match(draftOutreach({ business_name: business.name, category: "bar", address: null, phone: null, website: null, areaLabel: "Puyallup" }, result.signals).body, /found your business on social media/);
});

for (const profileHtml of [
  '<title>Copper Kettle | Facebook</title><p>Copper Kettle — Miami</p>',
  '<title>Different business | Facebook</title><p>Different business, Puyallup 253-555-0123</p>',
  '<title>Log in to Instagram</title><p>Copper Kettle Puyallup</p>',
  '<title>Other page</title><script>"Copper Kettle Puyallup 2535550123"</script>',
  '<title>Different business | Facebook</title><p>A post about Copper Kettle Puyallup 253-555-0123</p>',
]) await withFetch(url => htmlResponse(profileHtml + '<a href="https://wrong-business.com/">Website</a>', url), async () => {
  const result = await analyzeBusinessPresence({ ...business, social_profiles: [facebook] });
  assert.equal(result.signals.social_profiles?.[0].status, "unconfirmed");
  assert.equal(result.website, null, "identity mismatch / login page cannot supply a website");
  assert.equal(calls.length, 1);
});

for (const location of ["https://internal.local/", "https://facebook.com/login/", "https://evil.com/copper/"]) {
  await withFetch(() => new Response(null, { status: 302, headers: { location } }), async () => {
    const result = await analyzeBusinessPresence({ ...business, social_profiles: [facebook] });
    assert.equal(result.signals.social_profiles?.[0].status, "unconfirmed");
    assert.deepEqual(calls, [facebook.url], "reject unsafe/login redirects before a second request");
  });
}

await withFetch(() => new Response("blocked", { status: 403 }), async () => {
  const result = await analyzeBusinessPresence({ ...business, social_profiles: [facebook] });
  assert.equal(result.signals.social_profiles?.[0].status, "unconfirmed");
  assert.equal(result.signals.has_website, false);
});

await withFetch(url => htmlResponse('<title>Copper Kettle</title><p>Copper Kettle Puyallup</p><a href="https://one-business.com/">Link</a><a href="https://two-business.com/">Link</a>', url), async () => {
  const result = await analyzeBusinessPresence({ ...business, social_profiles: [facebook] });
  assert.equal(result.website, null, "conflicting external links require review");
  assert.equal(calls.length, 1);
});

await withFetch(url => htmlResponse('<title>Copper Kettle</title><p>Copper Kettle Puyallup</p><a href="https://one-business.com/">Website</a><a href="https://two-business.com/">Official website</a>', url), async () => {
  const result = await analyzeBusinessPresence({ ...business, social_profiles: [facebook] });
  assert.equal(result.website, null, "multiple explicit website links remain inconclusive");
});

await withFetch(url => htmlResponse('<title>Copper Kettle</title><p>Copper Kettle Puyallup</p><a href="https://news-story.com/">Read our news</a><script>{"external_url":"https://unrelated-ad.com/"}</script>', url), async () => {
  const result = await analyzeBusinessPresence({ ...business, social_profiles: [facebook] });
  assert.equal(result.website, null, "posts and unrelated embedded profile fields are not website evidence");
  assert.equal(calls.length, 1);
});

await withFetch(url => htmlResponse(url.includes("instagram") ? '<title>Copper Kettle | Instagram</title><p>Copper Kettle Puyallup</p>' : cleanHtml + `<a href="${instagram.url}">Instagram</a><a href="https://facebook.com/sharer.php">Share</a>`, url), async () => {
  const result = await analyzeBusinessPresence({ ...business, website: "https://copperkettle.com/" });
  assert.equal(result.signals.social_profiles?.[0].source, "website");
  assert.equal(result.signals.social_profiles?.[0].status, "matched");
  assert.equal(result.signals.social_profiles?.length, 1, "share widgets do not become business profiles");
  assert.equal(result.website, "https://copperkettle.com/");
});

await withFetch(() => new Response(JSON.stringify({ elements: [{ type: "node", id: 101, tags: { "contact:facebook": "copperkettle" } }] }), { headers: { "content-type": "application/json" } }), async () => {
  assert.equal((await refreshSocialProfiles("node:101"))[0].url, facebook.url);
  assert.deepEqual(await refreshSocialProfiles("node:102"), [], "refresh only the identical OSM object");
  assert.deepEqual(await refreshSocialProfiles("node:101);out;"), [], "OSM query identity cannot be injected");
  assert.equal(calls.length, 2);
});



// A single down provider falls back without changing OSM identity.
await withFetch((url, init) => {
  assert.equal(init?.method, "POST");
  assert.match(String(init?.body), /timeout%3A12/, "server timeout is shorter than HTTP deadline");
  if (url.includes("overpass-api.de")) throw new DOMException("The operation was aborted", "AbortError");
  return new Response(JSON.stringify({ elements: [
    { type: "node", id: 317, tags: { name: "Mirror Coffee", amenity: "cafe" } },
  ] }), { status: 200, headers: { "content-type": "application/json" } });
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 3000, ["cafes"], 12);
  assert.equal(found.length, 1, "second provider accepted");
  assert.equal(found[0].source_ref, "node:317", "stable OSM identity retained");
  assert.ok(calls[0].includes("overpass-api.de"));
  assert.ok(calls[1].includes("overpass.private.coffee"));
  assert.equal(calls.length, 2, "do not call third provider after success");
});

// HTTP rate limiting and overload from two independent providers must use
// a third documented instance rather than treating HTTP 200 as the only signal.
await withFetch(url => {
  if (url.includes("overpass-api.de")) return new Response("rate limited", { status: 429 });
  if (url.includes("overpass.private.coffee")) return new Response("busy", { status: 504 });
  return new Response(JSON.stringify({ elements: [
    { type: "way", id: 909, tags: { name: "Third Provider Cafe", amenity: "cafe" } },
  ] }), { headers: { "content-type": "application/json" } });
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 3000, ["cafes"], 12);
  assert.deepEqual(found.map(p => p.source_ref), ["way:909"]);
  assert.ok(calls[2].includes("maps.mail.ru/osm/tools/overpass/api/interpreter"));
  assert.equal(calls.length, 3, "exactly three sequential attempts");
});

// An Overpass HTTP 200 may still contain a runtime error in its JSON remark.
await withFetch(url => {
  if (url.includes("overpass-api.de")) return new Response(JSON.stringify({ remark: "runtime error: Query timed out", elements: [] }));
  if (url.includes("overpass.private.coffee")) return new Response(JSON.stringify({ unexpected: true }));
  return new Response(JSON.stringify({ elements: [
    { type: "node", id: 310, tags: { name: "Fallback Restaurant", amenity: "restaurant" } },
  ] }));
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 3000, ["restaurants"], 12);
  assert.equal(found[0].source_ref, "node:310");
  assert.equal(calls.length, 3, "runtime remark and malformed JSON must not count as success");
});

const originalWarn = console.warn;
const providerWarnings: unknown[][] = [];
console.warn = (...args) => { providerWarnings.push(args); };
try {
  await withFetch(() => { throw new DOMException("The operation was aborted", "AbortError"); }, async () => {
    await assert.rejects(
      discoverBusinesses(47.1, -122.3, 3000, ["cafes"], 12),
      /Business directory providers are unavailable \(3 checked\)\. No prospects saved/,
      "all providers failing produces a safe, actionable user message",
    );
    assert.equal(calls.length, 3, "bounded to three independent providers");
  });
} finally {
  console.warn = originalWarn;
}
assert.equal(providerWarnings.length, 3, "a diagnostic for each failed provider");
for (const [message, detail] of providerWarnings) {
  assert.equal(message, "[NHS scanner] Overpass provider unavailable");
  assert.equal((detail as { reason: string }).reason, "timeout");
  assert.equal(typeof (detail as { duration_ms: number }).duration_ms, "number");
  assert.ok(!JSON.stringify(detail).includes("47.1"), "search coordinates not logged");
}

await withFetch(() => { throw new DOMException("The operation was aborted", "AbortError"); }, async () => {
  const { geocode } = await import("../lib/prospect-scan.ts");
  await assert.rejects(geocode("Puyallup, WA"), /Location lookup is temporarily unavailable/);
  assert.equal(calls.length, 1, "a failed location lookup does not launch a business search");
});

// Geoapify is the primary when the deployed Worker has its secret.
// Neither location search nor logging should leak the API key.
await withFetch((url, init) => {
  assert.equal(url, "https://api.geoapify.com/v2/places");
  assert.equal(init?.method, "POST");
  const headers = init?.headers as Record<string, string>;
  assert.equal(headers["x-api-key"], "test-geoapify-key");
  const body = JSON.parse(String(init?.body));
  assert.deepEqual(body.categories, ["catering.restaurant"]);
  assert.deepEqual(body.filter, { type: "circle", lon: -122.3, lat: 47.1, radius: 8047 });
  assert.ok(!JSON.stringify(body).includes("test-geoapify-key"));
  return new Response(JSON.stringify({ features: [
    { properties: {
      name: "Copper Kettle", formatted: "123 Main St, Puyallup, WA",
      place_id: "abcdef1234567890", lat: 47.1, lon: -122.3,
      categories: ["catering.restaurant"],
      datasource: { raw: { osm_type: "n", osm_id: 501, amenity: "restaurant",
        website: "https://copperkettle.com", "contact:instagram": "@copperkettle" } },
    } },
    { properties: { name: "Copper Kettle", place_id: "abcdef1234567890",
      datasource: { raw: { osm_type: "n", osm_id: 501 } } } },
    { properties: { name: "Unnamed", place_id: "1234567890abcdef",
      datasource: { raw: { osm_type: "w", osm_id: 88, amenity: "restaurant" } } } },
  ] }), { headers: { "content-type": "application/json" } });
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 8047, ["restaurants"], 24, "test-geoapify-key");
  assert.equal(found.length, 2, "deduplication uses stable OSM IDs, not business names");
  assert.deepEqual(found.map(b => b.source_ref), ["node:501", "way:88"]);
  assert.equal(found[0].website, "https://copperkettle.com/");
  assert.equal(found[0].social_profiles[0].platform, "instagram");
  assert.equal(found[0].address, "123 Main St, Puyallup, WA");
  assert.equal(calls.length, 1, "Geoapify success never calls the public Overpass servers");
});

await withFetch((url) => {
  if (url.includes("geoapify.com")) return new Response("rate limited", { status: 429 });
  return new Response(JSON.stringify({ elements: [
    { type: "node", id: 777, tags: { name: "Fallback Cafe", amenity: "cafe" } },
  ] }), { headers: { "content-type": "application/json" } });
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 3000, ["cafes"], 12, "test-geoapify-key");
  assert.equal(found[0].source_ref, "node:777", "Geoapify outage falls back to Overpass");
  assert.equal(calls.length, 2);
  assert.ok(calls[0].includes("api.geoapify.com"));
  assert.ok(calls[1].includes("overpass-api.de"));
});

await withFetch((url) => {
  if (url.includes("geoapify.com")) return new Response(JSON.stringify({ features: [
    { properties: { name: "Stable Place", place_id: "1ab2cd3ef4567890",
      categories: ["sport.fitness.gym"] } },
    { properties: { name: "No ID", place_id: "bad!", categories: ["sport.fitness.gym"] } },
  ] }));
  throw new Error("Unexpected Overpass request");
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 3000, ["fitness"], 12, "test-geoapify-key");
  assert.deepEqual(found.map(p => p.source_ref), ["geoapify:1ab2cd3ef4567890"], "fallback IDs are stable");
  assert.equal(calls.length, 1);
});

console.log("verify:scanner — all checks passed.");
