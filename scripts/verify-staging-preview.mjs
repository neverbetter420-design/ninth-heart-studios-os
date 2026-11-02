import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Read-only CI contract: staging is a distinct free Supabase project, and
// neither a privileged Supabase key nor production route can enter this preview.
const source = (name) => JSON.parse(readFileSync(name, "utf8"));
const staging = source("wrangler.nocturne-staging-preview.jsonc");
const inert = source("wrangler.nocturne-preview.jsonc");
const live = source("wrangler.jsonc");
assert.equal(staging.name, inert.name);
assert.notEqual(staging.name, live.name);
assert.equal(staging.workers_dev, false);
assert.equal(staging.preview_urls, true);
assert.deepEqual(staging.routes, []);
assert.equal(staging.keep_vars, false);
assert.equal(staging.main, inert.main);
assert.deepEqual(staging.assets, inert.assets);
assert.deepEqual(staging.compatibility_flags, inert.compatibility_flags);
assert.equal(staging.compatibility_date, inert.compatibility_date);
assert.equal(staging.vars.NEXT_PUBLIC_SUPABASE_URL, "https://qihwmfwlhsetxwggaesd.supabase.co");
assert.notEqual(staging.vars.NEXT_PUBLIC_SUPABASE_URL, live.vars?.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(staging.vars.NHS_APP_URL,
  "https://review-muse-62-64-integrated-main-202611-ninth-heart-studios-os.neverbetter420.workers.dev");
assert.equal(staging.vars.MUSE_AI_ENABLED, "false");
assert.equal(staging.vars.MUSE_PROJECT_GUIDE_ENABLED, "false");
const publicKey = staging.vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.match(publicKey, /^sb_publishable_[A-Za-z0-9_-]+$/);
assert.deepEqual(staging.previews, { vars: staging.vars }, "Preview must not inherit production values");
assert.deepEqual(Object.keys(staging.vars).sort(), [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NHS_APP_URL", "MUSE_AI_ENABLED", "MUSE_PROJECT_GUIDE_ENABLED"
].sort());
assert.deepEqual(Object.keys(staging).sort(), Object.keys(inert).sort(),
  "Unexpected Worker settings, routes or bindings require review");
assert.equal(process.env.CLOUDFLARE_API_TOKEN || "", "");
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY || "", "");
assert.equal(process.env.SUPABASE_SECRET_KEY || "", "");
assert.equal(process.env.OPENAI_API_KEY || "", "");
assert.equal(process.env.RESEND_API_KEY || "", "");
console.log("PASS: staging-only public Supabase credentials and Access-only Worker Preview; Muse off");
