/**
 * NHS Command Center Chapter I artwork gate.
 *
 * Deliberately permits the documented no-art gradient preview while the
 * exact owner-approved image bytes are unavailable. Both files must arrive
 * together and pass source SHA-256 plus native PNG dimension validation
 * before any image-backed Chapter I activation may be merged or reviewed.
 *
 * This verifies source identity, NOT visual signoff or deployment approval.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const images = [
  {
    view: "desktop",
    path: "public/visuals/nhs-command-chapter-i-desktop.png",
    width: 1672,
    height: 941,
    sha256: "e7e59728a863cf96287109481e04653654aa6d9c5104a4a96b45172be8ee5411",
  },
  {
    view: "mobile",
    path: "public/visuals/nhs-command-chapter-i-mobile.png",
    width: 942,
    height: 1670,
    sha256: "700e06d16362e15d3a10500acedf5470d2d1011e6883126ec45e816bb3c0866e",
  },
];
const css = readFileSync("app/nhs-command-chapters.css", "utf8");
const manifest = readFileSync("docs/design/NHS-COMMAND-CENTER-APPROVED-RESPONSIVE-BACKGROUNDS.md", "utf8");
const present = images.filter(({path}) => existsSync(path));

assert.equal(present.length === 0 || present.length === images.length, true,
  "STOP: Chapter I art must be staged as an exact matching desktop/mobile pair");
assert.doesNotMatch(css, /nhs-dark-rose-photographic\.webp|nhs-at2-command-center\.webp/,
  "STOP: retired Observatory background must not be activated in the chapter stylesheet");
assert.match(css, /var\(--nhs-command-chapter-i-desktop, none\)/,
  "Missing explicit gradient fallback for uninstalled desktop Chapter I art");
assert.match(css, /var\(--nhs-command-chapter-i-mobile, var\(--nhs-command-chapter-i-desktop, none\)\)/,
  "Missing responsive mobile art slot and fallback");
assert.match(css, /transition:\s*opacity\s+800ms/,
  "Missing approved chapter transition");
assert.match(css, /prefers-reduced-motion:\s*reduce/,
  "Missing reduced-motion chapter transition safety");

for (const image of images) {
  assert.ok(manifest.includes(image.sha256),
    "Approved Chapter I checksum missing from owner's visual source record: " + image.view);
  const activated = css.includes(
    '--nhs-command-chapter-i-' + image.view + ': url("/visuals/' + image.path.split("/").at(-1) + '")'
  );
  if (present.length === 0) {
    assert.equal(activated, false,
      "STOP: Chapter I " + image.view + " artwork CSS activated before binary delivery");
    continue;
  }
  const data = readFileSync(image.path);
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a",
    "STOP: not a valid PNG file: " + image.path);
  assert.equal(data.subarray(12,16).toString("ascii"), "IHDR",
    "STOP: missing PNG IHDR: " + image.path);
  assert.equal(data.readUInt32BE(16), image.width,
    "STOP: approved " + image.view + " artwork width changed");
  assert.equal(data.readUInt32BE(20), image.height,
    "STOP: approved " + image.view + " artwork height changed");
  assert.equal(createHash("sha256").update(data).digest("hex"), image.sha256,
    "STOP: unapproved or re-encoded " + image.view + " artwork substituted");
  assert.equal(activated, true,
    "STOP: delivered image is not wired into its matching responsive Chapter I CSS variable");
}

if (present.length === 0) {
  console.log("PENDING ART, PASS SOURCE GATE: exact Chapter I desktop/mobile PNG pair not installed; gradient-only preview remains active.");
} else {
  console.log("PASS SOURCE GATE: both Chapter I owner-approved PNG binaries and responsive CSS mappings are SHA-verified. Screenshots and visual approval still required.");
}
