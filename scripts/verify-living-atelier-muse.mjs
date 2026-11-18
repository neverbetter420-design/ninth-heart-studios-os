import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/(protected)/(admin)/muse/page.tsx");
const dock = read("components/MuseRoomDock.tsx");
const css = read("app/living-atelier-muse-chamber.css");
const layout = read("app/layout.tsx");
const concierge = read("components/MuseConcierge.tsx");
const currentScene = read("app/nhs-room-editorial.css");

assert.match(page, /await requireAdmin\(\)/);
assert.match(page, /const supabase = await createClient\(\)/);
assert.match(page, /recommendNextAction\(/);
assert.match(page, /rankLeads\(/);
assert.match(page, /summarizeProjectRisk\(/);
assert.match(page, /await supabase\.from\("muse_drafts"\)\.insert/);
assert.match(page, /await supabase\s*\.from\("muse_drafts"\)/);
assert.match(page, /sendDraftEmail/);
assert.match(page, /name="draft_id"/);
assert.match(page, /name="to"/);
assert.match(page, /Confirm send/);
assert.match(page, /Save draft/);
assert.match(page, /<MuseRoomDock \/>/);
assert.doesNotMatch(page, /fetch\("\/api\/admin\/muse-ai/,
  "The deterministic Muse page must not automatically invoke disabled AI routes");

assert.match(dock, /aria-label="Muse destinations"/);
for (const [id, title] of [
  ["muse-focus", "Studio focus"],
  ["muse-compose", "Write a draft"],
  ["muse-saved", "Saved drafts"],
]) {
  assert.ok(dock.includes('id: "' + id + '"'), "Missing Muse anchor: " + id);
  assert.ok(dock.includes('label: "' + title + '"'), "Missing original navigation label: " + title);
  assert.ok(page.includes('id="' + id + '"'), "Corresponding section absent: " + id);
}
assert.match(dock, /IntersectionObserver/);
assert.match(dock, /observer\.disconnect\(\)/);
assert.match(dock, /href=\{\`#\$\{id\}\`\}/);
assert.match(dock, /aria-current=\{current === id \? "location" : undefined\}/);
assert.match(dock, /onClick=\{\(\) => setCurrent\(id\)\}/);
assert.doesNotMatch(dock, /fetch\(|\.insert\(|\.update\(|\.delete\(|localStorage|sessionStorage|muse-ai\/route/,
  "The Muse navigation dock must be local-only and non-mutating");

const roomScope = ".app-shell.nhs-theme-admin.nhs-open-plan";
assert.ok(css.includes(roomScope), "Muse treatment must be restricted to Admin");
assert.ok(css.includes('data-room="velvet"'), "Muse must stay in its designated velvet room");
assert.ok(css.includes("#workspace-content .muse-workroom"), "Muse styles must stay on the Muse page");
assert.doesNotMatch(css, /nhs-theme-client|@import|https?:\/\//,
  "Muse styling must never repaint the Client Portal or request external images");
const brandedUrls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]).sort();
assert.deepEqual(brandedUrls, [
  "/visuals/nhs-room-velvet-oracle.svg",
  "/visuals/nhs-wallpaper-velvet.svg",
], "Only the two existing NHS velvet SVG assets are permitted as long-page backing");
for (const asset of brandedUrls) {
  assert.match(read("public" + asset), /<svg\s/);
}
assert.match(css, /FIXED NHS ROOM CANVAS/);
assert.match(css, /position:fixed;/);
assert.match(css, /height:100lvh;/);
assert.match(css, /background-repeat:no-repeat,no-repeat,no-repeat,no-repeat,no-repeat;/);
assert.match(css, /background-attachment:scroll;/);
assert.match(css, /var\(--nhs-at2-room-photo, var\(--nhs-cinematic-room-photo\)\)/);
assert.match(css, /pointer-events:none;/);
assert.match(css, /z-index:0;/);
assert.match(css, /#workspace-content\s*\{\s*position:relative;\s*z-index:1;/);
assert.doesNotMatch(css, /background-attachment:fixed;|repeat-y/,
  "The Muse artwork must stay on a single fixed viewport canvas, not tile or scroll with cards");
assert.match(css, /background:Canvas/);
for (const required of [
  ".nhs-muse-room-dock", ".studio-focus", ".studio-intelligence-grid",
  ".studio-compose", ".studio-writing-grid", ".studio-saved",
  "backdrop-filter", "min-height:44px", "focus-visible",
  "max-width:720px", "max-width:370px",
  "prefers-reduced-motion:reduce",
  "prefers-reduced-transparency:reduce",
  "forced-colors:active"
]) assert.ok(css.includes(required), "Missing Muse glass/accessibility rule: " + required);
assert.match(currentScene, /nhs-scene-velvet\.webp/,
  "The existing approved velvet-room artwork must stay available");
const imports = layout.match(/import "\.\/[^"]+\.css";/g) ?? [];
assert.deepEqual(imports.slice(-5), [
  'import "./living-atelier-pulse-dock.css";',
  'import "./living-atelier-client-sanctuary.css";',
  'import "./living-atelier-muse-chamber.css";',
  'import "./living-atelier-crystal-glass.css";',
  'import "./living-atelier-typefaces.css";',
], "Muse follows approved Admin/Client layers, with final glass/typography scoped");
assert.match(concierge, /enabled = false/);
assert.match(concierge, /previewOpen = false/);
console.log("PASS: Muse Living Atelier glass/anchors preserve admin access, deterministic drafts, explicit send and disabled AI defaults");
