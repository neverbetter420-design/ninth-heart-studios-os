import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(path, "utf8");
const dashboard = source("components/Dashboard.tsx");
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
assert.match(dashboard, /<MetricCard\s/);
assert.match(dashboard, /<details className="nocturne-insights">/);
assert.match(originalCss, /nhs-dark-rose-photographic\.webp/);

// New navigation is real and accessible; decorative glyphs are inert.
assert.match(dashboard, /<nav className="velvet-passages" aria-label="Quick studio navigation">/);
assert.match(dashboard, /<Link key=\{passage.href\} href=\{passage.href\}/);
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
assert.match(css, /\.velvet-passages__links/);
assert.match(css, /\.project-panel[\s\S]*?background: transparent;/);
assert.match(dashboard, /className="empty-dashboard-actions velvet-open-empty"/);
assert.match(dashboard, /className="velvet-priority-orbit" aria-hidden="true"/);
assert.match(dashboard, /velvet-orbit-point--rose/);
assert.match(dashboard, /velvet-orbit-point--key/);
assert.match(dashboard, /className="velvet-project-empty"/);
assert.match(css, /\.nocturne-command-center\.velvet-atelier-pilot :is\(\.action-panel,\.project-panel\)/);
assert.match(css, /\.nocturne-command-center\.velvet-atelier-pilot \.metric-card:first-child/);
assert.match(css, /\.nav-link\.active/);
assert.match(css, /:has\(\.nocturne-command-center\.velvet-atelier-pilot\)/);
assert.match(css, /prefers-contrast: more/);

console.log("PASS: original NHS logo, floral artwork, data and interactive Priority Halo preserved");
console.log("PASS: four accessible icon-first routes and skull/rose/key motifs");
console.log("PASS: unframed Admin panels, floating orbit, unobtrusive sidebar, responsive and keyboard guards");
