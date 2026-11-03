import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path, "utf8");
const dashboard = source("components/Dashboard.tsx");
const living = source("components/LivingStudioHub.tsx");
const glyphs = source("components/AtelierSymbol.tsx");
const css = source("app/velvet-atelier-admin-pilot.css");
const layout = source("app/layout.tsx");
const sidebar = source("components/Sidebar.tsx");
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
assert.equal(cssImports.at(-1), 'import "./velvet-atelier-admin-pilot.css";');
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
const expectedUrl = "https://design-velvet-atelier-admin-pilot-202611-ninth-heart-studios-os.neverbetter420.workers.dev";
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
assert.deepEqual(Object.keys(previewConfig).sort(), Object.keys(stagingConfig).sort());
assert.deepEqual(Object.keys(previewConfig.vars).sort(), allowedVars.sort());
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

