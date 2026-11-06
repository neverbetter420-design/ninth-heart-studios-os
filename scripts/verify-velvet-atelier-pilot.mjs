import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path, "utf8");
const dashboard = source("components/Dashboard.tsx");
const living = source("components/LivingStudioHub.tsx");
const glyphs = source("components/AtelierSymbol.tsx");
const css = source("app/velvet-atelier-admin-pilot.css");
const layout = source("app/layout.tsx");
const sidebar = source("components/RoomNavigation.tsx");
const originalCss = source("app/nocturne-dark-rose-cinematic.css");

// Protect the approved identity and original live, data-driven widgets.
assert.match(sidebar, /\/brand\/nhs-original-logo\.webp/);
assert.match(dashboard, /className="content-wrap nocturne-command-center velvet-atelier-pilot"/);
assert.match(dashboard, /<NocturneStudioArt \/>/);
assert.match(dashboard, /<PriorityHalo\s/);
assert.match(dashboard, /rankLeads\(/);
assert.match(dashboard, /<LivingStudioHub\s/);
assert.match(living, /metrics\.map\(/);
assert.match(living, /projects\s*\.map\(/);
assert.match(dashboard, /<details className="nocturne-insights">/);
assert.match(originalCss, /nhs-dark-rose-photographic\.webp/);

// New navigation is real and accessible; decorative glyphs are inert.
assert.match(living, /<nav className="living-orbit" aria-label="Studio command hub">/);
assert.match(living, /key=\{passage.href\}/);
assert.match(living, /href=\{passage.href\}/);
assert.match(living, /\/brand\/nhs-original-logo\.webp/);
assert.match(dashboard, /aria-hidden="true">\s*<span><AtelierSymbol name="skull"/);
for (const route of ["/leads", "/projects", "/clients", "/opportunities"]) {
  assert.ok(dashboard.includes('href: "' + route + '"'), "Missing functional shortcut " + route);
}
for (const symbol of ["skull", "rose", "key", "spark"]) {
  assert.ok(glyphs.includes('name === "' + symbol + '"'), "Missing " + symbol + " motif");
}
assert.match(glyphs, /aria-hidden="true"/);
assert.match(glyphs, /focusable="false"/);

// A late imported, opt-in layer, not another global site repaint.
const cssImports = layout.match(/import "\.\/[^"]+\.css";/g) || [];
assert.equal(cssImports.at(-2), 'import "./open-plan.css";');
assert.equal(cssImports.at(-1), 'import "./nhs-room-editorial.css";');
assert.match(source("app/nhs-room-editorial.css"), /nhs-theme-admin/);
assert.ok(cssImports.indexOf('import "./velvet-atelier-admin-pilot.css";') < cssImports.length - 1);
assert.match(css, /\.nocturne-command-center\.velvet-atelier-pilot/);
assert.doesNotMatch(css, /\.nhs-theme-client\b/);
assert.doesNotMatch(css, /!important/);
assert.doesNotMatch(css, /#fff(?:fff)?\b/i);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /prefers-contrast: more/);
assert.match(css, /focus-visible/);
assert.match(css, /max-width: 680px/);
assert.match(css, /\.living-orbit__link/);
assert.match(css, /\.project-panel[\s\S]*?background: transparent;/);
assert.match(dashboard, /className="empty-dashboard-actions velvet-open-empty"/);
assert.match(dashboard, /className="velvet-priority-orbit" aria-hidden="true"/);
assert.match(dashboard, /velvet-orbit-point--rose/);
assert.match(dashboard, /velvet-orbit-point--key/);
assert.match(dashboard, /className="velvet-project-empty"/);
assert.match(css, /\.nocturne-command-center\.velvet-atelier-pilot :is\(\.action-panel,\.project-panel\)/);
assert.match(css, /\.living-status__metric/);
assert.match(css, /\.nav-link\.active/);
assert.match(css, /:has\(\.nocturne-command-center\.velvet-atelier-pilot\)/);
assert.match(css, /prefers-contrast: more/);

console.log("PASS: original NHS logo, floral artwork, data and interactive Priority Halo preserved");
console.log("PASS: four accessible icon-first routes and skull/rose/key motifs");
console.log("PASS: unframed Admin panels, floating orbit, unobtrusive sidebar, responsive and keyboard guards");

assert.match(css, /living-orbit-breathe/);
assert.match(css, /\.living-orbit__link:focus-visible/);
assert.match(living, /role="progressbar"/);
assert.match(living, /recentProgress === null/);
console.log("PASS: Living Dashboard circular hub, data-based progress and accessible focus");

// Preview preparation is source-only. A future publish requires a separate
// owner authorization, protected Access policy and exact-head verification.
const liveConfig = JSON.parse(source("wrangler.jsonc"));
const stagingConfig = JSON.parse(source("wrangler.nocturne-staging-preview.jsonc"));
const previewConfig = JSON.parse(source("wrangler.velvet-atelier-admin-preview.jsonc"));
// Deliberately inert until a dedicated version/branch preview URL exists.
// Never reuse the existing production Worker’s preview hostname for this worker.
const expectedUrl = "https://example.invalid";
const allowedVars = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NHS_APP_URL", "MUSE_AI_ENABLED", "MUSE_PROJECT_GUIDE_ENABLED"
];
assert.equal(liveConfig.name, "ninth-heart-studios-os");
assert.equal(previewConfig.name, "nhs-os-velvet-atelier-preview");
assert.notEqual(previewConfig.name, stagingConfig.name);
assert.notEqual(previewConfig.name, liveConfig.name);
assert.equal(previewConfig.main, stagingConfig.main);
assert.deepEqual(previewConfig.assets, stagingConfig.assets);
assert.equal(previewConfig.compatibility_date, stagingConfig.compatibility_date);
assert.deepEqual(previewConfig.compatibility_flags, stagingConfig.compatibility_flags);
assert.equal(previewConfig.workers_dev, false);
assert.equal(previewConfig.preview_urls, true);
assert.deepEqual(previewConfig.routes, []);
assert.equal(previewConfig.keep_vars, false);
// Stage parity alone is insufficient: two configs could acquire the same
// dangerous binding or publish trigger and still compare equal. Lock the
// pilot's entire top-level surface to this reviewed source-only shape.
const previewKeys = [
  "$schema", "name", "main", "compatibility_date", "compatibility_flags",
  "workers_dev", "preview_urls", "routes", "keep_vars", "assets",
  "vars", "previews",
];
assert.deepEqual(Object.keys(previewConfig).sort(), previewKeys.sort(),
  "Unexpected preview setting or binding requires independent release review");
assert.deepEqual(Object.keys(previewConfig.vars).sort(), allowedVars.sort());
assert.deepEqual(Object.keys(previewConfig.previews), ["vars"],
  "Preview-specific bindings must contain only the reviewed vars object");
assert.deepEqual(previewConfig.vars, previewConfig.previews.vars);
assert.equal(previewConfig.vars.NHS_APP_URL, expectedUrl);
assert.equal(previewConfig.vars.MUSE_AI_ENABLED, "false");
assert.equal(previewConfig.vars.MUSE_PROJECT_GUIDE_ENABLED, "false");
assert.deepEqual(
  {...previewConfig.vars, NHS_APP_URL: stagingConfig.vars.NHS_APP_URL},
  stagingConfig.vars,
  "The pilot may differ from the existing staging config only by its app callback URL"
);
console.log("PASS: independent, route-free, credential-limited pilot preview config; Muse flags OFF");
// The dedicated Admin QA may validate source, but must never publish it.
const pilotWorkflow = source(".github/workflows/velvet-atelier-admin-pilot.yml");
assert.match(pilotWorkflow, /permissions:\s*\n\s*contents:\s*read\b/);
assert.match(pilotWorkflow, /persist-credentials:\s*false/);
assert.match(pilotWorkflow, /NEXT_PUBLIC_SUPABASE_URL:\s*https:\/\/example\.supabase\.co/);
assert.match(pilotWorkflow, /NHS_APP_URL:\s*https:\/\/example\.invalid/);
assert.match(pilotWorkflow, /MUSE_AI_ENABLED:\s*'false'/);
assert.match(pilotWorkflow, /MUSE_PROJECT_GUIDE_ENABLED:\s*'false'/);
assert.doesNotMatch(pilotWorkflow, /CLOUDFLARE_API_TOKEN|wrangler-action|\bwrangler\s+(?:deploy|versions upload)|\bcf:deploy\b|\bsecrets\.|environment:\s*production/i,
  "Pilot QA must remain non-deploying and credential-free");
console.log("PASS: Admin pilot workflow cannot publish, use release credentials or enable Muse");




// Seven-room design continuity is a release contract, not a one-page mockup.
const editorial = source("app/nhs-room-editorial.css");
assert.match(editorial, /NHS EDITORIAL CONTINUITY LOCK/);
for (const selector of [
  ".management-client-row", ".paperwork-row", ".lead-inbox-row",
  ".studio-workspace-admin", ".pipeline-phase", ".atelier-project-row",
  ".atelier-resource-row", ".scanner-deep-job", ".studio-project-settings"
]) {
  assert.ok(editorial.includes(selector), `The approved open/glass room system must cover \${selector}`);
}
assert.match(editorial, /prefers-reduced-motion/);
assert.match(editorial, /forced-colors:active/);
console.log("PASS: shared editorial continuity guard covers deep Admin and Client Portal screens");
