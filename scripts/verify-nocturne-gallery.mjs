import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Fail closed: this only validates a static, synthetic screenshot gallery.
// It never publishes a Worker or connects to remote Supabase.
const config = JSON.parse(readFileSync("wrangler.nocturne-gallery.jsonc", "utf8"));
assert.deepEqual(Object.keys(config).sort(),
  ["$schema", "name", "compatibility_date", "workers_dev", "routes", "keep_vars", "assets"].sort(),
  "Only explicitly reviewed static Worker configuration keys are permitted");
assert.equal(config.name, "nhs-nocturne-visual-review");
assert.equal(config.workers_dev, true);
assert.deepEqual(config.routes, []);
assert.equal(config.keep_vars, false);
assert.deepEqual(config.assets, { directory: "./design-preview" });
assert.equal(Object.hasOwn(config, "main"), false, "Static gallery must have no code entrypoint");
const files = readdirSync("design-preview");
const pngs = files.filter((file) => file.endsWith(".png"));
assert.equal(pngs.length, 56, "A hosted review must contain all 56 desktop/mobile captures");
assert.equal(files.length, 59, "Only 56 screenshots, two galleries and a headers file may be published");
const expected = new Set(["index.html", "Open_This_Review.html", "_headers", ...pngs]);
for (const file of files) {
  assert.ok(expected.has(file), "Unexpected hosted gallery asset: " + file);
  assert.ok(/^[a-z0-9-]+-(desktop|mobile)\.png$/.test(file) ||
    ["index.html", "Open_This_Review.html", "_headers"].includes(file),
    "Unsafe asset filename: " + file);
  assert.ok(statSync(join("design-preview", file)).isFile());
}
const index = readFileSync("design-preview/index.html", "utf8");
const download = readFileSync("design-preview/Open_This_Review.html", "utf8");
assert.equal(index, download, "Root gallery and downloadable review must match");
assert.ok(index.includes("Synthetic CI design screenshots"));
assert.ok(index.includes("not a signed-in app"));
assert.ok(!/https?:\/\//i.test(index), "No external network URLs may be embedded in the gallery");
assert.ok(!/rquscwgdrqkzwjukiqtk|app\.ninthheartstudios\.com|sb_secret_|service_role/i.test(index),
  "Do not include hosted backend endpoints or production identifiers");
for (const filename of pngs) {
  assert.ok(index.includes(filename), "Gallery missing screenshot: " + filename);
  assert.ok(statSync(join("design-preview", filename)).size > 1000,
    "Empty screenshot: " + filename);
}
const headers = readFileSync("design-preview/_headers", "utf8");
assert.ok(headers.includes("connect-src 'none'"), "Gallery must block external requests");
assert.ok(headers.includes("frame-ancestors 'none'"));
console.log("Static Nocturne gallery isolation verified: no backend, no Worker code, 56 screenshots.");
