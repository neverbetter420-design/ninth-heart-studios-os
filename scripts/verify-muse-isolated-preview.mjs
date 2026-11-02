import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Source-only safety check for the isolated Muse/Nocturne Worker bundle.
// It never calls Cloudflare, Supabase, or an external AI provider.
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const preview = read("wrangler.nocturne-preview.jsonc");
const live = read("wrangler.jsonc");

assert.equal(process.env.CLOUDFLARE_API_TOKEN || "", "", "No Cloudflare deployment credential in CI");
assert.equal(process.env.SUPABASE_ACCESS_TOKEN || "", "", "No hosted Supabase access token in CI");
assert.equal(process.env.SUPABASE_DB_PASSWORD || "", "", "No hosted database password in CI");
assert.equal(process.env.OPENAI_API_KEY || "", "", "No AI provider key in CI");
assert.notEqual(process.env.MUSE_PROJECT_GUIDE_ENABLED, "true", "Muse must stay disabled");
assert.notEqual(process.env.MUSE_AI_ENABLED, "true", "Muse AI must stay disabled");

assert.equal(live.name, "ninth-heart-studios-os");
assert.equal(preview.name, "nhs-os-nocturne-preview");
assert.notEqual(preview.name, live.name, "Preview must not target live Worker");
assert.equal(preview.main, ".open-next/worker.js");
assert.equal(preview.main, live.main);
assert.equal(preview.workers_dev, true);
assert.deepEqual(preview.routes, [], "Preview must not claim a production route");
assert.equal(preview.keep_vars, false, "Preview must not inherit live variables");
assert.equal(preview.compatibility_date, live.compatibility_date);
assert.deepEqual(preview.compatibility_flags, live.compatibility_flags);
assert.deepEqual(preview.assets, live.assets);
assert.deepEqual(preview.previews, {
  vars: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
    NHS_APP_URL: "https://example.invalid",
  },
}, "Only inert preview values are permitted");
assert.deepEqual(Object.keys(preview).sort(), [
  "$schema", "name", "main", "compatibility_date", "compatibility_flags",
  "workers_dev", "routes", "keep_vars", "assets", "previews",
].sort(), "Unexpected preview bindings or routes require a new security review");

if (process.argv.includes("--require-bundle")) {
  assert.ok(existsSync(".open-next/worker.js"),
    "OpenNext Worker missing; use npm run cf:build, not npm run build");
  assert.ok(existsSync(".open-next/assets"), "OpenNext static assets missing");
}

console.log("PASS: distinct inert preview Worker, no live routes, secrets, or bindings");
console.log("PASS: Muse feature flags disabled and Cloudflare credentials absent");
if (process.argv.includes("--require-bundle")) {
  console.log("PASS: OpenNext Worker and assets are generated for an offline dry-run");
}
