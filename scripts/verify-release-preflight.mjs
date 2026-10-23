import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = resolve(".");
const read = (path) => readFileSync(resolve(repo, path), "utf8");
const migrations = readdirSync(resolve(repo, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
const appliedVersions = [
  "20261012020000","20261012020050","20261012020100","20261012030000",
  "20261012040000","20261012040001","20261012050000","20261012060000",
  "20261012070000","20261012080000","20261012080001","20261013033207",
  "20261013040000","20261013050000","20261013050001","20261013060000",
  "20261013232917","20261014060417","20261014070000","20261015001632",
  "20261015001941","20261015005039","20261020063055",
];
const proposedVersion = "20261017030000";
// Explicitly inventoried future migrations (none after this verified apply).
const reviewedDraftVersions = [];
const checks = [
  ["Production migration-history baseline is represented in source", () => {
    for (const version of appliedVersions) {
      assert.equal(migrations.filter((file) => file.startsWith(version + "_")).length, 1,
        "Missing or duplicate production migration: " + version);
    }
    assert.equal(new Set(appliedVersions).size, appliedVersions.length);
    assert.equal(migrations.length, appliedVersions.length + 1 + reviewedDraftVersions.length,
      "Unexpected additional SQL migrations require a new approved inventory review.");
    assert.equal(migrations.filter((f) => f.startsWith(proposedVersion + "_")).length, 1,
      "Proposed security change must remain separate from already-applied migrations.");
    for (const version of reviewedDraftVersions) {
      assert.equal(migrations.filter((f) => f.startsWith(version + "_")).length, 1,
        "Each reviewed future schema migration must be explicit and unique: " + version);
    }
  }],
  ["Applied Softr parity migration remains isolated and admin-only", () => {
    const sql = read("supabase/migrations/20261020063055_lead_search_review_queue.sql");
    assert.match(sql, /create table if not exists public\.lead_search_requests/i);
    assert.match(sql, /create table if not exists public\.lead_search_results/i);
    assert.match(sql, /alter table public\.lead_search_requests enable row level security/i);
    assert.match(sql, /alter table public\.lead_search_results enable row level security/i);
    assert.equal((sql.match(/private\.is_admin\(\)/g) || []).length, 4);
    assert.doesNotMatch(sql, /(?:\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b)/i);
  }],
  ["Recovered form-source RLS migration binds to storage object path", () => {
    const sql = read("supabase/migrations/20261014060417_fix_form_source_policy_object_path.sql");
    assert.match(sql, /where ft\.source_file_path = storage\.objects\.name/i);
    assert.match(sql, /private\.can_access_project\(fs\.project_id\)/i);
    assert.match(sql, /bucket_id = 'form-sources'/i);
  }],
  ["Historical client document guards parse in fresh migration replay", () => {
    const sql = read("supabase/migrations/20261013232917_secure_client_document_updates.sql");
    assert.equal((sql.match(/\$function\$;/g) || []).length, 2,
      "Both function definitions must end with a semicolon.");
  }],
  ["Production Worker deployment is manual and environment-gated", () => {
    const yml = read(".github/workflows/deploy-cloudflare.yml");
    assert.match(yml, /on:\s*\n\s*workflow_dispatch:/);
    assert.doesNotMatch(yml, /\n\s*(push|pull_request|schedule):/);
    assert.match(yml, /environment:\s*production/);
    assert.match(yml, /Checkout approved main/);
    assert.match(yml, /npm run cf:dry-run/);
    assert.match(yml, /npm run cf:deploy/);
    assert.match(yml, /secrets\.CLOUDFLARE_API_TOKEN/);
    assert.match(yml, /github.actor == 'neverbetter420-design'/);
    assert.match(yml, /github.ref == 'refs\/heads\/main'/);
    assert.match(yml, /approval_phrase:/);
    assert.match(yml, /expected_main_sha:/);
    assert.match(yml, /verified_security_migration:/);
    assert.match(yml, /I_APPROVE_NHS_OS_PRODUCTION_DEPLOY/);
    assert.match(yml, /I_VERIFIED_SUPABASE_HARDENING/);
    assert.match(yml, /EXPECTED_MAIN_SHA/);
    const wrangler = JSON.parse(read("wrangler.jsonc"));
    assert.equal(wrangler.name, "ninth-heart-studios-os");
    assert.equal(wrangler.keep_vars, true);
  }],
  ["Nocturne preview Worker is isolated from production", () => {
    const live = JSON.parse(read("wrangler.jsonc"));
    const preview = JSON.parse(read("wrangler.nocturne-preview.jsonc"));
    assert.equal(live.name, "ninth-heart-studios-os");
    assert.equal(preview.name, "nhs-os-nocturne-preview");
    assert.notEqual(preview.name, live.name, "Preview must never target production Worker");
    assert.equal(preview.main, live.main);
    assert.deepEqual(preview.assets, live.assets);
    assert.equal(preview.compatibility_date, live.compatibility_date);
    assert.deepEqual(preview.compatibility_flags, live.compatibility_flags);
    assert.equal(preview.workers_dev, true);
    assert.deepEqual(preview.routes, [], "Preview cannot attach to an existing domain");
    assert.equal(preview.keep_vars, false, "Preview cannot retain unrelated existing variables");
    assert.deepEqual(preview.previews, {
      vars: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder",
        NHS_APP_URL: "https://example.invalid",
      },
    }, "Preview Worker must use only inert, test-only backend values");
    assert.deepEqual(
      Object.keys(preview).sort(),
      ["$schema", "name", "main", "compatibility_date", "compatibility_flags",
        "workers_dev", "routes", "keep_vars", "assets", "previews"].sort(),
      "Any additional preview bindings, routes or account overrides require explicit review",
    );
  }],
  ["Proposed protection remains versioned as a future change", () => {
    const sql = read("supabase/migrations/20261017030000_phase3_client_decision_sender_guard.sql");
    assert.match(sql, /private\.guard_client_approval_decision\(\)/);
    assert.match(sql, /sender_id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /DRAFT ONLY/);
  }],
];
let failures = 0;
for (const [name, run] of checks) {
  try { run(); console.log("PASS:", name); }
  catch (e) { failures++; console.error("FAIL:", name, e.message); }
}
console.log((checks.length - failures) + "/" + checks.length + " release source checks passed (read-only; no production access)");
if (failures) process.exitCode = 1;
