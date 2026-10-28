// Unit tests for evidence-based homepage industry audits.
// These operate only on HTML strings and do not visit or mutate businesses.
import assert from "node:assert/strict";
import { auditIndustryHomepage } from "../lib/prospect-industry-audit.ts";
import { analyzeWebsite } from "../lib/prospect-scan.ts";

const source = `<!doctype html><html><head><title>Neighborhood Restaurant</title></head><body>
<a href="/menu.pdf">View Our Menu</a>
<a href="https://www.opentable.com/r/restaurant-example">Reserve a table</a>
<a href="/contact">Contact</a></body></html>`;
const r = auditIndustryHomepage("restaurants", source, "2026-10-28T00:00:00Z");
assert.equal(r.version, 1);
assert.equal(r.scope, "homepage_only");
assert.equal(r.category, "restaurants");
assert.equal(r.scanned_at, "2026-10-28T00:00:00Z");
assert.equal(r.signals.find(x => x.key === "menu")?.status, "observed");
assert.equal(r.signals.find(x => x.key === "reservations")?.status, "observed");
assert.equal(r.signals.find(x => x.key === "ordering")?.status, "not_observed_on_homepage");
assert.equal(r.signals.find(x => x.key === "contact_path")?.status, "observed");
assert.ok(r.signals.find(x => x.key === "ordering")?.evidence.includes("may exist on another page"));

const jsOnly = auditIndustryHomepage("salons", `<html><script>
const nonsense='book appointment our services portfolio';
</script><style>.book-appointment { display: none }</style><div>Welcome</div></html>`);
assert.equal(jsOnly.signals.find(x => x.key === "booking")?.status, "not_observed_on_homepage");
assert.equal(jsOnly.signals.find(x => x.key === "services")?.status, "not_observed_on_homepage");
const salon = auditIndustryHomepage("salons", `<a href="/book">Schedule appointment</a>
<a href="/services">Services and pricing</a><a href="/gallery">Our work</a>`);
for (const k of ["booking", "services", "portfolio"]) assert.equal(
  salon.signals.find(x => x.key === k)?.status, "observed", k,
);
const bar = auditIndustryHomepage("bars", `<a href="/events">Upcoming Events</a>
<p>Happy hour available every Friday</p>`);
assert.equal(bar.signals.find(x => x.key === "events")?.status, "observed");
assert.equal(bar.signals.find(x => x.key === "hours")?.status, "observed");
const contractor = auditIndustryHomepage("contractors", `<a href="/get-a-quote">Free Estimate</a>
<a href="/services">Our services</a> Serving the Tacoma area.`);
assert.equal(contractor.signals.find(x => x.key === "estimate")?.status, "observed");
assert.equal(contractor.signals.find(x => x.key === "area")?.status, "observed");
const fitness = auditIndustryHomepage("fitness", `<a href="/classes">Class schedule</a><a href="/membership">Join now</a>`);
assert.equal(fitness.signals.find(x => x.key === "classes")?.status, "observed");
assert.equal(fitness.signals.find(x => x.key === "membership")?.status, "observed");

// The HTTP parser must attach the audit to the already retrieved homepage.
// Never make a second fetch for site-specific evidence.
const originalFetch = globalThis.fetch;
let fetchCount = 0;
try {
  globalThis.fetch = async () => {
    fetchCount++;
    return new Response(source, { status: 200, headers: { "content-type": "text/html" } });
  };
  const withIndustry = await analyzeWebsite("https://example-real-domain.com", "restaurants");
  assert.equal(fetchCount, 1);
  assert.equal(withIndustry.industry_audit?.category, "restaurants");
  assert.equal(withIndustry.industry_audit?.signals.find(x => x.key === "reservations")?.status, "observed");
  const generic = await analyzeWebsite("https://example-real-domain.com");
  assert.equal(generic.industry_audit, undefined, "no audit without known niche");
  const missing = await analyzeWebsite(null, "restaurants");
  assert.equal(missing.industry_audit, undefined, "missing website cannot be audited");
} finally {
  globalThis.fetch = originalFetch;
}
console.log("verify:industry-audit — all checks passed.");
