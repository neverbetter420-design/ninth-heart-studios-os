// Business verification: pure, evidence-only checks with no external HTTP.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBusinessVerification, safeVerificationLink } from "../lib/prospect-verification.ts";
import type { WebsiteSignals } from "../lib/prospect-scan.ts";

const at = "2026-10-28T10:00:00.000Z";
const input = { source_ref: "node:123456", name: "Copper Kettle",
  address: "123 Main St, Puyallup, WA", phone: "253-555-0188",
  website: "https://copperkettle.com/" };
const signals: WebsiteSignals = {
  has_website: true, reachable: true, https: true, mobile_viewport: true,
  builder: null, title_ok: true, description_ok: true, stale_copyright: false,
  copyright_year: null, load_ms: 350, page_bytes: 2000,
};
const listed = buildBusinessVerification(input, signals, at);
assert.equal(listed.status, "listed_only", "reachable website is not proof of identity");
assert.equal(listed.version, 1);
assert.equal(listed.checked_at, at);
assert.equal(listed.evidence.length, 4);
assert.ok(listed.evidence.some(e => e.key === "phone" && e.status === "listed"));
assert.ok(listed.evidence.some(e => e.key === "website" && e.status === "observed"));
const directory = listed.evidence.find(e => e.key === "identity")!;
assert.equal(safeVerificationLink(directory), "https://www.openstreetmap.org/node/123456");
assert.ok(listed.evidence.every(e => e.observed_at === at));
const withoutProviderLink = buildBusinessVerification({ ...input, source_ref: "geoapify:abcdefgh1234" }, signals, at);
assert.ok(withoutProviderLink.evidence.every(e => e.source === "website" || !e.source_url),
  "Geoapify place IDs are not invented booking/source URLs");
const matchedSocial = {
  platform: "instagram" as const, status: "matched" as const,
  source: "listing" as const, url: "https://www.instagram.com/copperkettle/",
  evidence: "Public profile matches business name and location",
};
const checked = buildBusinessVerification(input, {
  ...signals, social_checked_at: "2026-10-28T10:00:30.000Z",
  social_profiles: [matchedSocial],
}, at);
assert.equal(checked.status, "corroborated");
const corroborated = checked.evidence.find(e => e.key === "social-instagram")!;
assert.equal(corroborated.status, "corroborated");
assert.equal(corroborated.observed_at, "2026-10-28T10:00:30.000Z");
assert.ok(corroborated.detail.includes("not proof of ownership"));
assert.equal(safeVerificationLink(corroborated), "https://www.instagram.com/copperkettle/");
const unconfirmed = buildBusinessVerification(input, {
  ...signals, social_profiles: [{ ...matchedSocial, status: "unconfirmed" }],
}, at);
assert.equal(unconfirmed.status, "needs_review");
assert.ok(unconfirmed.evidence.some(e => e.key === "social-instagram" && e.status === "unconfirmed"));
const noSite = buildBusinessVerification({ ...input, website: null }, {
  ...signals, reachable: false, has_website: false
}, at);
assert.equal(noSite.status, "listed_only");
assert.ok(!noSite.evidence.some(e => e.key === "website"));
const unreachable = buildBusinessVerification(input, {
  ...signals, reachable: false
}, at);
assert.equal(unreachable.status, "needs_review");
assert.ok(unreachable.evidence.some(e => e.key === "website" && e.status === "unconfirmed"));

const evidence = { ...corroborated };
for (const bad of [
  "javascript:alert(1)", "http://127.0.0.1/", "https://instagram.com.evil.com/profile/",
  "https://www.facebook.com/login/", "https://www.instagram.com/p/",
  "https://www.facebook.com/profile.php", "https://evil.com/",
]) assert.equal(safeVerificationLink({ ...evidence, source_url: bad }), null, bad);
assert.equal(safeVerificationLink({
  ...evidence, source_url: "https://www.facebook.com/profile.php?id=123"
}), "https://www.facebook.com/profile.php?id=123");
const compromisedDirectory = { ...directory, source_url: "https://evil.com/node/123456" };
assert.equal(safeVerificationLink(compromisedDirectory), null);
assert.equal(safeVerificationLink({
  ...listed.evidence.find(e => e.key === "website")!, source_url: "http://localhost:8080/"
}), null);

const scan = readFileSync("lib/prospect-scan.ts", "utf8");
const action = readFileSync("app/(protected)/(admin)/leads/discover/actions.ts", "utf8");
const ui = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(scan, /verification: buildBusinessVerification\(/);
assert.match(action, /source_ref: p\.source_ref, name: p\.business_name/);
assert.match(ui, /safeVerificationLink\(item\)/);
assert.match(ui, /Identity evidence/);
assert.match(ui, /Public signals do not establish legal ownership/);
assert.doesNotMatch(ui, /Business ownership verified/);
console.log("verify:prospect-verification — source lineage and false-positive protections passed.");
