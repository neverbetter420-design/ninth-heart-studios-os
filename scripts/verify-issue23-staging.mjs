import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const staging = JSON.parse(readFileSync("wrangler.issue23-staging.jsonc", "utf8"));
const prod = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
const approved = JSON.parse(readFileSync("wrangler.nocturne-preview.jsonc", "utf8"));

assert.equal(staging.name, "nhs-os-issue23-staging");
assert.notEqual(staging.name, prod.name, "Staging must not share production Worker identity");
assert.notEqual(staging.name, approved.name, "Staging must not overwrite the existing preview Worker");
assert.equal(staging.main, prod.main);
assert.equal(staging.compatibility_date, prod.compatibility_date);
assert.deepEqual(staging.compatibility_flags, prod.compatibility_flags);
assert.deepEqual(staging.assets, prod.assets);
assert.equal(staging.workers_dev, true, "Staging must have its own workers.dev address");
assert.deepEqual(staging.routes, [], "Staging cannot route custom domains");
assert.equal(staging.keep_vars, false, "Staging cannot inherit production credentials");
assert.deepEqual(staging.vars, {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
  NHS_APP_URL: "https://example.invalid"
}, "Only inert backend and return-URL variables are permitted");
assert.deepEqual(Object.keys(staging).sort(), [
  "$schema", "name", "main", "compatibility_date", "compatibility_flags",
  "workers_dev", "routes", "keep_vars", "vars", "assets"
].sort(), "Staging gained an unexpected binding or route; review before deployment");
console.log("PASS: Staging Worker identity, no production routes, no inherited secrets, inert backend variables");
console.log("This checks only the source configuration. It does not deploy or verify hosted staging.");
