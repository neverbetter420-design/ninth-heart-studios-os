// Prospect Scanner verification: scoring, badges, drafts, URL normalization.
// No database, no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFinderForm, websiteHost, isSameBusiness, completenessScore, discoverGeoapify, geocodeGeoapify, findBusinesses } from "../lib/lead-finder.ts";
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



// Provider outages must not expose AbortError to the user. Retry the documented
// independent Overpass mirror once, preserving stable OSM identity and labels.
await withFetch((url) => {
  if (url.includes("overpass-api.de")) throw new DOMException("The operation was aborted", "AbortError");
  return new Response(JSON.stringify({ elements: [
    { type: "node", id: 317, tags: { name: "Mirror Coffee", amenity: "cafe" } },
  ] }), { status: 200, headers: { "content-type": "application/json" } });
}, async () => {
  const found = await discoverBusinesses(47.1, -122.3, 3000, ["cafes"], 12);
  assert.equal(found.length, 1, "mirror result accepted");
  assert.equal(found[0].source_ref, "node:317", "mirror retains OSM identity");
  assert.ok(calls[0].includes("overpass-api.de"));
  assert.ok(calls[1].includes("overpass.private.coffee"));
  assert.equal(calls.length, 2, "only two bounded sequential attempts");
});

await withFetch(() => { throw new DOMException("The operation was aborted", "AbortError"); }, async () => {
  await assert.rejects(
    discoverBusinesses(47.1, -122.3, 3000, ["cafes"], 12),
    /Business directory is busy or unreachable/,
    "all failed endpoints produce an actionable message",
  );
  assert.equal(calls.length, 2, "never retry indefinitely");
});

await withFetch(() => { throw new DOMException("The operation was aborted", "AbortError"); }, async () => {
  const { geocode } = await import("../lib/prospect-scan.ts");
  await assert.rejects(geocode("Puyallup, WA"), /Location lookup is temporarily unavailable/);
  assert.equal(calls.length, 1, "a failed location lookup does not launch a business search");
});


// NHS Lead Finder v2: source selection, input bounds, no auto-import by default,
// no name-only deduplication, and a server-only Geoapify Places adapter.
const searchForm = new FormData();
searchForm.set("source", "geoapify");
searchForm.set("location", "Puyallup, WA");
searchForm.set("radius_mi", "10");
searchForm.set("result_limit", "20");
searchForm.set("top_count", "5");
searchForm.append("niches", "restaurants");
searchForm.append("niches", "bars");
searchForm.append("niches", "not_an_option");
const request = parseFinderForm(searchForm);
assert.equal(request.source, "geoapify");
assert.equal(request.auto_import, false, "no automatic CRM writes without explicit opt-in");
assert.deepEqual(request.niches, ["restaurants", "bars"]);
assert.equal(request.result_limit, 20);
searchForm.set("auto_import", "on");
assert.equal(parseFinderForm(searchForm).auto_import, true);
searchForm.set("radius_mi", "999999");
assert.throws(() => parseFinderForm(searchForm), /Check the search radius/);
searchForm.set("radius_mi", "10");
assert.equal(websiteHost("https://instagram.com/example/"), null, "social profile is not a standalone website");
assert.equal(websiteHost("https://example.com/"), "example.com");
assert.equal(isSameBusiness(
  {source_ref:"node:101",business_name:"Shared Name",address:"123 First Street"},
  {source_ref:"way:202",business_name:"Shared Name",address:"789 Second Street"},
), false, "same name at a different OSM location must remain distinct");
assert.ok(isSameBusiness({website:"https://www.example.com/"},{website:"https://example.com/new"}));
assert.equal(isSameBusiness(
  {business_name:"Shared Bakery",address:"123 Main St",website:"https://bakery.example/first"},
  {business_name:"Shared Bakery",address:"987 Oak Ave",website:"https://bakery.example/second"},
), false, "franchise branches at different addresses remain distinct");
assert.equal(isSameBusiness(
  {business_name:"Bakery One", website:"https://shared.example/bakery"},
  {business_name:"Restaurant Two", website:"https://shared.example/restaurant"},
), false, "shared hosting does not erase separately named businesses");
assert.equal(completenessScore({website:"example.com",phone:"253-555-0123",address:"Main St"}), 70);
assert.equal(completenessScore({website:null,phone:null,address:"Main St"}), 5);

const previousPlacesFetch = globalThis.fetch;
try {
  let called = 0;
  globalThis.fetch = async (input, init) => {
    called++;
    assert.equal(String(input), "https://api.geoapify.com/v2/places");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string,string>)["x-api-key"], "fixture-key");
    const requestBody = JSON.parse(String(init?.body));
    assert.equal(requestBody.filter.type, "circle");
    assert.equal(requestBody.filter.radius, 16093);
    assert.ok(requestBody.categories.includes("catering.restaurant"));
    assert.ok(requestBody.categories.includes("catering.pub"));
    return new Response(JSON.stringify({ type: "FeatureCollection", features: [{
      properties: { name:"Cedar & Stone", formatted:"Puyallup, WA",
        website:"example.com", lat:47.1, lon:-122.3, place_id:"abcdefghi1234",
        datasource: { raw: { osm_type:"n",osm_id:317,amenity:"restaurant",
          "contact:instagram":"@cedarstone" } } },
    }] }), {status:200,headers:{"content-type":"application/json"}});
  };
  const found = await discoverGeoapify(47.1,-122.3,16093,["restaurants","bars"],20,"fixture-key");
  assert.equal(called,1);
  assert.equal(found.length,1);
  assert.equal(found[0].source_ref,"node:317");
  assert.equal(found[0].website,"https://example.com/");
  assert.equal(found[0].social_profiles[0].status,"unconfirmed");
  globalThis.fetch = async () => new Response("unavailable",{status:503});
  await assert.rejects(discoverGeoapify(47.1,-122.3,2000,["bars"],10,"fixture-key"),
    /Places provider is unavailable/);
} finally {
  globalThis.fetch = previousPlacesFetch;
}


// Geoapify path must not rely on Nominatim's public geocoding availability.
// Both the geocoder and Places search accept the same PRIVATE x-api-key header.
const priorGeoKey = process.env.GEOAPIFY_API_KEY;
const beforeGeoFetch = globalThis.fetch;
try {
  process.env.GEOAPIFY_API_KEY = "ci-private-fixture-only";
  let geocodeCalls = 0;
  let placesCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal((init?.headers as Record<string,string>)["x-api-key"],"ci-private-fixture-only");
    assert.ok(!url.includes("ci-private-fixture-only"),"secret never enters the URL");
    if (url.includes("/v1/geocode/search")) {
      geocodeCalls++;
      assert.equal(new URL(url).searchParams.get("text"),"Puyallup, WA");
      assert.equal(new URL(url).searchParams.get("format"),"geojson");
      return new Response(JSON.stringify({
        type:"FeatureCollection",
        features:[{properties:{lat:47.19,lon:-122.29}}],
      }), {status:200,headers:{"content-type":"application/json"}});
    }
    assert.equal(url,"https://api.geoapify.com/v2/places");
    placesCalls++;
    assert.equal(init?.method,"POST");
    return new Response(JSON.stringify({features:[{
      properties:{name:"Geoapify Coffee",place_id:"abcdefghi123456",
        datasource:{raw:{osm_type:"node",osm_id:421,amenity:"cafe"}}},
    }]}), {status:200,headers:{"content-type":"application/json"}});
  };
  const businesses = await findBusinesses({...request,source:"geoapify",niches:["cafes"]});
  assert.equal(businesses[0].source_ref,"node:421");
  assert.equal(geocodeCalls,1,"Geoapify geocodes once");
  assert.equal(placesCalls,1,"Geoapify Places searches once");
} finally {
  globalThis.fetch = beforeGeoFetch;
  if(priorGeoKey===undefined)delete process.env.GEOAPIFY_API_KEY;
  else process.env.GEOAPIFY_API_KEY=priorGeoKey;
}


// Both Geoapify adapters must bound JSON body consumption, not merely the
// initial response headers. A slow provider used to leave an open scan forever.
{
  const originalFetch = globalThis.fetch;
  const originalTimer = globalThis.setTimeout;
  try {
    // Shorten only the adapters' real timeouts while keeping the response body pending.
    globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0], delay?: number) =>
      originalTimer(handler, delay === 12000 || delay === 10000 ? 5 : delay)) as typeof setTimeout;
    globalThis.fetch = async (_input, init) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener("abort", () =>
          controller.error(new DOMException("The operation was aborted", "AbortError")), { once: true });
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
    const mustTimeout = async (promise: Promise<unknown>, label: string) => {
      const guard = originalTimer(() => {}, 100);
      clearTimeout(guard);
      let guardTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await assert.rejects(Promise.race([promise, new Promise((_resolve, reject) => {
          guardTimer = originalTimer(() => reject(new Error("Stalled JSON body escaped adapter timeout")), 100);
        })]), /timed out/, label);
      } finally {
        if (guardTimer) clearTimeout(guardTimer);
      }
    };
    await mustTimeout(discoverGeoapify(47.1,-122.3,2000,["bars"],10,"fixture-key"), "Places JSON timeout");
    await mustTimeout(geocodeGeoapify("Puyallup, WA","fixture-key"), "Geocoder JSON timeout");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalTimer;
  }
}

// Import -> audit handoff is staged rather than secretly activating
// scheduled scans, bulk outreach or a real-time third-party website fetch.
const finderActionsSource = readFileSync(new URL("../app/(protected)/(admin)/leads/discover/lead-finder-actions.ts", import.meta.url), "utf8");
const leadActionsSource = readFileSync(new URL("../app/(protected)/(admin)/leads/actions.ts", import.meta.url), "utf8");
const leadDetailSource = readFileSync(new URL("../app/(protected)/(admin)/leads/[leadId]/page.tsx", import.meta.url), "utf8");
assert.match(finderActionsSource, /website_audit:\s*\{\s*status:\s*"queued"/, "import creates queued audit metadata");
assert.doesNotMatch(finderActionsSource, /await\s+analyzeWebsite\s*\(/, "bulk import never fetches all sites");
assert.match(leadActionsSource, /export async function auditLeadWebsite\(formData: FormData\)/, "manual audit action exists");
assert.match(leadActionsSource, /const \{ user \} = await requireAdmin\(\)/, "admin authentication required");
assert.match(leadActionsSource, /const signals = await analyzeWebsite\(website\)/, "audit uses established safe-site analyzer");
assert.match(leadActionsSource, /status = signals\.reachable \? "complete" : "inconclusive"/,
  "unreachable sites cannot be scored as bad websites");
assert.match(leadDetailSource, /<form action=\{auditLeadWebsite\}>/, "lead detail has explicit audit trigger");
assert.match(leadDetailSource, /Audits are on-demand/, "audit is not automatically scheduled");

console.log("verify:scanner — all checks passed.");
