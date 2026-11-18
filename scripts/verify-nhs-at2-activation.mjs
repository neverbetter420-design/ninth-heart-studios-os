import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const read = file => readFileSync(file, "utf8");
const hash = b => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(read("docs/design/nhs-at2-assets.json"));
const active = read("app/living-atelier-artwork-active.css");
const root = read("app/layout.tsx");
const appShell = read("components/AppShell.tsx");

assert.equal(manifest.assets.length, 8, "Only eight selected NHS backgrounds are permitted");
assert.equal(new Set(manifest.assets.map(a => a.file)).size, 8);
assert.equal(Object.hasOwn(manifest, "reserve"), false, "No excluded image in manifest");
for (const entry of manifest.assets) {
  assert.match(entry.file, /^nhs-at2-[a-z0-9-]+\.webp$/);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  const path = "public/visuals/" + entry.file;
  assert.ok(existsSync(path), "Imported file missing: " + path);
  const binary = readFileSync(path);
  assert.equal(binary.length, entry.bytes, "Size mismatch: " + path);
  assert.equal(hash(binary), entry.sha256, "Image content changed: " + path);
}

const expectedActive = [
  ["observatory", "nhs-at2-command-center.webp"],
  ["velvet", "nhs-at2-muse-chamber.webp"],
  ["artist", "nhs-at2-project-pipeline.webp"],
  ["electric", "nhs-at2-workspace-floral.webp"],
  ["private", "nhs-at2-client-sanctuary.webp"],
];
for (const [room, file] of expectedActive) {
  assert.ok(active.includes('data-room="' + room + '"'), "Room not scoped: " + room);
  assert.equal(active.split('url("/visuals/' + file + '")').length - 1, 1, "Incorrect or repeated room art: " + file);
}
assert.match(active, /data-room="private"[^}]*:has\(\.atelier-home\.nhs-color-studio\)/,
  "Client artwork must not bleed into other private routes");
assert.match(active, /\.muse-workroom/, "Muse artwork must target the Muse page");
assert.ok(active.includes('url("/visuals/nhs-at2-brand-welcome.webp")'));
assert.ok(active.includes('url("/visuals/nhs-at2-mobile-welcome.webp")'));
assert.ok(active.includes('max-width: 740px'), "Mobile portrait override missing");
assert.ok(active.includes('.auth-form input[name="password"]'), "Sign-in scenery must stay on real sign-in form");
assert.doesNotMatch(active, /nhs-at2-admin-entrance\.webp/, "Alternate Admin entrance is not activated");
assert.doesNotMatch(active, /background-size:\s*cover|https?:\/\/|@import/,
  "Do not crop, fetch external artwork or import unrelated styles");
assert.match(active, /background-size:\s*100% 100%,\s*contain,\s*100% 100%/);
assert.match(active, /position:\s*fixed/);
assert.match(active, /pointer-events:\s*none/);
assert.match(active, /prefers-reduced-transparency/);
assert.match(active, /forced-colors:\s*active/);

for (const path of [
  "app/nhs-room-editorial.css",
  "app/living-atelier-pulse-dock.css",
  "app/living-atelier-muse-chamber.css",
  "app/living-atelier-client-sanctuary.css"
]) {
  const scene = read(path);
  assert.match(scene, /background-size:[^;]*contain/, path + " loses full-image fit");
  if (path === "app/nhs-room-editorial.css" || path === "app/living-atelier-pulse-dock.css" || path === "app/living-atelier-muse-chamber.css") {
    assert.match(scene, /position:\s*fixed/, path + " loses stationary scenery");
  }
}

const ordered = [
  'import "./living-atelier-crystal-glass.css";',
  'import "./living-atelier-typefaces.css";',
  'import "./living-atelier-artwork-active.css";',
];
assert.ok(root.includes(ordered.join("\n")), "Verified artwork must load after glass and fonts");
assert.match(read("app/living-atelier-crystal-glass.css"), /--nhs-crystal-blur:\s*blur\(28px\)/);
assert.match(read("app/living-atelier-typefaces.css"), /NHS Single Ghost Local/);
assert.match(read("app/living-atelier-typefaces.css"), /NHS Anger Styles Local/);
assert.match(appShell, /<RoomIdentity role=\{role\}/);
assert.match(read("components/RoomNavigation.tsx"), /nhs-original-logo\.webp/,
  "The original NHS logo must not be replaced");

console.log("PASS: eight exact SHA-verified images, scoped fixed full-frame room activation, glass and fonts untouched, sign-in portrait only on mobile, original logo retained. DRAFT only.");
