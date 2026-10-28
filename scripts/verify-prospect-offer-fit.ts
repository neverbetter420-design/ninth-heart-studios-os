// NHS offer fit: deterministic owner-review suggestions, never a sales proof.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { suggestNhsOffers } from "../lib/prospect-offer-fit.ts";
import { auditIndustryHomepage } from "../lib/prospect-industry-audit.ts";
import { draftOutreach, type WebsiteSignals } from "../lib/prospect-scan.ts";

const baseline: WebsiteSignals = {
  has_website: true, reachable: true, https: true, mobile_viewport: true,
  builder: null, title_ok: true, description_ok: true,
  stale_copyright: false, copyright_year: null, load_ms: 300, page_bytes: 2200,
};
const fromAudit = (category: Parameters<typeof auditIndustryHomepage>[0], html: string) =>
  ({ ...baseline, industry_audit: auditIndustryHomepage(category, html) });
const noSite = suggestNhsOffers("restaurant", null, { ...baseline, has_website: false });
assert.equal(noSite.length, 1);
assert.equal(noSite[0].key, "consultation");
assert.equal(noSite[0].draft_angle, null);
assert.match(noSite[0].reason, /No specific, substantiated service need/);
assert.equal(suggestNhsOffers("pub", "https://venue.com", { ...baseline, reachable: false })[0].key, "consultation");
assert.equal(suggestNhsOffers("restaurant", "https://venue.com", baseline)[0].key, "consultation");

const restaurant = fromAudit("restaurants", "<p>Welcome to our restaurant</p>");
const rest = suggestNhsOffers("restaurant", "https://venue.com", restaurant);
assert.deepEqual(rest.map(x => x.key), ["menu-setup", "online-ordering"]);
assert.ok(rest.every(x => x.basis === "homepage_review"));
assert.ok(rest.every(x => /not.*homepage|homepage.*not|was not detected/i.test(x.reason)));
assert.ok(rest[0].draft_angle?.includes("might be elsewhere"));
const salon = suggestNhsOffers("hairdresser", "https://salon.com",
  fromAudit("salons", "<h1>Hair salon</h1>"));
assert.equal(salon[0].key, "booking-form");
assert.match(salon[0].reason, /not evidence that an existing system is absent/i);
const contractor = suggestNhsOffers("plumber", "https://trades.com",
  fromAudit("contractors", "<h1>Plumbing services</h1>"));
assert.equal(contractor[0].key, "booking-form");
const bar = suggestNhsOffers("pub", "https://bar.com", {
  ...fromAudit("bars", "<h1>Neighborhood Pub</h1>"),
  mobile_viewport: false, title_ok: false,
});
assert.equal(bar[0].key, "tavern-key");
assert.equal(bar[0].title, "The Tavern Key");
assert.equal(bar[0].kind, "package");
assert.equal(bar[1].key, "menu-setup");
assert.match(bar[0].reason, /not proof/i);
const genericRedesign = suggestNhsOffers("hairdresser", "https://salon.com", {
  ...baseline, mobile_viewport: false, title_ok: false,
});
assert.equal(genericRedesign[0].key, "website-redesign");
const seo = suggestNhsOffers("restaurant", "https://venue.com", {
  ...baseline, description_ok: false,
});
assert.equal(seo[0].key, "seo-boost");
assert.match(seo[0].reason, /not a ranking, traffic, or performance diagnosis/i);
const noFalseAlarm = suggestNhsOffers("salons", "https://salon.com",
  fromAudit("salons", '<a href="/book">Book appointment</a><a href="/services">Services</a><a href="/gallery">Gallery</a>'));
assert.equal(noFalseAlarm[0].key, "consultation", "observed actions are not evidence of needs");
assert.equal(suggestNhsOffers("restaurant", "https://venue.com", restaurant, 1).length, 1);
assert.ok(suggestNhsOffers("restaurant", "https://venue.com", restaurant, 200).length <= 3);

const p = {
  business_name: "Copper Kettle", category: "restaurant",
  address: null, phone: null, website: "https://venue.com",
  areaLabel: "Puyallup, WA",
};
const personalized = draftOutreach(p, restaurant, rest[0].draft_angle);
assert.ok(personalized.body.includes("I couldn't confirm a menu action"));
assert.ok(personalized.body.includes("free 15-minute consultation"));
assert.ok(personalized.body.includes("Ninth Heart Studios"));
assert.equal(personalized.body.includes("guaranteed sales"), false);
const generic = draftOutreach(p, baseline);
assert.equal(generic.body.includes("I couldn't confirm a menu action"), false);

const action = readFileSync("app/(protected)/(admin)/leads/discover/actions.ts", "utf8");
const page = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(action, /suggestNhsOffers\(p\.category, p\.website, p\.signals, 1\)/);
assert.match(action, /p\.status !== "new" \|\| p\.outreach_status === "sent"/);
assert.match(action, /\.neq\("outreach_status", "sent"\)/);
assert.match(page, /Possible NHS service fit/);
assert.match(page, /Nothing is sent automatically/);
assert.match(page, /p\.status === "new" && p\.outreach_status !== "sent"/);
console.log("verify:prospect-offer-fit — cautious service suggestions and manual draft safeguards passed.");
