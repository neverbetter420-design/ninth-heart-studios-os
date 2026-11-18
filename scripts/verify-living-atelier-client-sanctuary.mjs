import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => readFileSync(path, "utf8");
const css = read("app/living-atelier-client-sanctuary.css");
const layout = read("app/layout.tsx");
const home = read("app/(protected)/portal/page.tsx");
const compass = read("components/portal/AtelierCompass.tsx");
const approvedImage = readFileSync("public/visuals/nhs-living-atelier-client-sanctuary.webp");
const approvedSha256 = "b0b259d26af5ac7d8ff07dbdc1c65fb5b517ad6856b8f9ec74ff1d10182ed9d6";

assert.equal(createHash("sha256").update(approvedImage).digest("hex"), approvedSha256,
  "STOP: the Client Sanctuary artwork differs from the approved uploaded WebP");
assert.ok(css.includes('url("/visuals/nhs-living-atelier-client-sanctuary.webp")'),
  "The correct approved image must be used");
assert.equal((css.match(/url\("\/visuals\/[^"]+"\)/g) ?? []).length, 1,
  "Do not substitute another image or duplicate wallpaper on every card");

const rootScope = ".app-shell.nhs-theme-client.nhs-open-plan:has(.atelier-home.nhs-color-studio)";
const contentScope = ".app-shell.nhs-theme-client.nhs-open-plan #workspace-content .atelier-home.nhs-color-studio";
assert.ok(css.includes(rootScope), "Sanctuary atmosphere must be restricted to the client home route");
assert.ok(css.includes(contentScope), "Floating glass styles must be restricted to Client Sanctuary content");
assert.doesNotMatch(css, /nhs-theme-admin|https?:\/\/|@import|position:\s*fixed/i,
  "Sanctuary must not affect Admin, fetch external imagery, or add floating overlays");
assert.ok(css.includes('--nhs-cinematic-room-photo: url("/visuals/nhs-living-atelier-client-sanctuary.webp")'));
for (const marker of [
  "atelier-feature-project", "nhs-atelier-compass", "atelier-destination-grid",
  "atelier-hero-copy", "background-position:center,center,center",
  "min-height:44px", "focus-visible", "max-width:740px",
  "prefers-reduced-motion:reduce", "prefers-reduced-transparency:reduce",
  "prefers-contrast:more", "forced-colors:active", "background-image:none !important"
]) assert.ok(css.includes(marker), "Missing design/accessibility guard: " + marker);

const imports = layout.match(/import "\.\/[^"]+\.css";/g) ?? [];
assert.deepEqual(imports.slice(-6), [
  'import "./visual-first.css";',
  'import "./living-atelier-pulse-dock.css";',
  'import "./living-atelier-client-sanctuary.css";',
  'import "./living-atelier-muse-chamber.css";',
  'import "./living-atelier-crystal-glass.css";',
  'import "./living-atelier-typefaces.css";',
], "Client Sanctuary precedes Muse and the last glass/typography refinements");

assert.match(home, /await requireUser\(\)/);
assert.match(home, /profile\.role !== "client"\) redirect\("\/"\)/);
assert.match(home, /await createClient\(\)/);
assert.match(home, /\.from\("projects"\)/);
assert.match(home, /\.from\("approvals"\)/);
assert.match(home, /<AtelierCompass\s/);
for (const route of ["/portal/messages","/portal/files","/portal/documents","/portal/approvals"]) {
  assert.ok(home.includes('href="' + route + '"'), "Missing current client shortcut: " + route);
}
assert.match(compass, /useState<CompassView>\("now"\)/);
assert.match(compass, /aria-pressed=\{view === tab\.id\}/);
assert.match(compass, /aria-valuenow=\{safeProgress\}/);
assert.match(compass, /aria-live="polite"/);
assert.match(read("components/AppShell.tsx"), /role === "client" \? "nhs-theme-client" : "nhs-theme-admin"/);
console.log("PASS: exact approved Client Sanctuary artwork, isolated glass, client role guard, existing interactive compass, mobile/contrast/motion safety; no new auth or data flows");
