// Read-only Prospect Insights acceptance checks. No external HTTP or database.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditIndustryHomepage } from "../lib/prospect-industry-audit.ts";
import { buildProspectInsights } from "../lib/prospect-insights.ts";
import type { WebsiteSignals } from "../lib/prospect-scan.ts";

const base: WebsiteSignals = {
  has_website: true, reachable: true, https: true, mobile_viewport: true,
  builder: null, title_ok: true, description_ok: true,
  stale_copyright: false, copyright_year: null,
  load_ms: 400, page_bytes: 2500,
};
const missing = buildProspectInsights({ ...base, has_website: false, reachable: false }, null);
assert.equal(missing.length, 1);
assert.equal(missing[0].kind, "unverified");
assert.match(missing[0].detail, /not proof one does not exist/i);
assert.equal(missing[0].evidence_url, undefined);
const unreachable = buildProspectInsights({ ...base, reachable: false }, "https://business.example");
assert.equal(unreachable[0].key, "unavailable");
assert.match(unreachable[0].detail, /Retry before drawing conclusions/);
const audit = auditIndustryHomepage("restaurants", [
  '<a href="/menu.pdf">Menu</a>',
  '<a href="https://www.opentable.com/r/example">Book a table</a>',
  '<p>Order with us in person.</p>',
].join("\n"), "2026-10-28T00:00:00Z", "https://business.example");
const s = { ...base, industry_audit: audit };
const result = buildProspectInsights(s, "https://business.example");
assert.ok(result.length <= 3);
assert.equal(result[0].kind, "review", "not-observed homepage actions remain mere review clues");
assert.match(result[0].detail, /may exist on a different page/i);
assert.equal(result[0].checked_at, "2026-10-28T00:00:00Z");
assert.ok(result.some(r => r.kind === "observed"));
assert.ok(result.every(r => !r.evidence_url || r.evidence_url.startsWith("https://business.example/")));
assert.ok(!result.some(r => r.evidence_url?.includes("opentable.com")),
  "outside reservation links cannot be presented as same-origin evidence");
const viewport = buildProspectInsights({ ...base, mobile_viewport: false, description_ok: false },
  "https://business.example");
assert.equal(viewport[0].key, "viewport");
assert.match(viewport[0].detail, /does not prove/i);
assert.equal(viewport[1].key, "description");
assert.equal(buildProspectInsights({ ...base, stale_copyright: true, copyright_year: 2020 },
  "https://business.example")[0].key, "copyright");
const noAssumptions = buildProspectInsights(base, "https://business.example");
assert.equal(noAssumptions[0].kind, "unverified");
assert.equal(buildProspectInsights(s, "https://business.example", 1).length, 1);
assert.ok(buildProspectInsights(s, "https://business.example", 20).length <= 6);
assert.equal(buildProspectInsights(s, "javascript:alert(1)")[0].key, "unknown-site");

const ui = readFileSync("app/(protected)/(admin)/leads/discover/page.tsx", "utf8");
assert.match(ui, /buildProspectInsights\(p\.signals, p\.website, 3\)/);
assert.match(ui, /Why review this business\?/);
assert.match(ui, /not confirmed defects or promises of sales/i);
assert.match(ui, /href=\{insight\.evidence_url\}/);
console.log("verify:prospect-insights — cautious homepage observations passed.");
