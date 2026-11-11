import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getStagingReviewDecision, REVIEW_PREVIEW_HOST, REVIEW_PREVIEW_ORIGIN, REVIEW_SUPABASE_ORIGIN } from "../lib/staging-read-only.ts";

const preview = JSON.parse(readFileSync(new URL("../wrangler.velvet-atelier-admin-preview.jsonc", import.meta.url), "utf8"));
const production = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
assert.equal(preview.name, "nhs-os-velvet-atelier-preview");
assert.notEqual(preview.name, production.name);
assert.equal(preview.workers_dev, false);
assert.equal(preview.preview_urls, true);
assert.deepEqual(preview.routes, []);
assert.equal(preview.keep_vars, false);
assert.deepEqual(preview.vars, preview.previews.vars);
assert.equal(preview.vars.NHS_STAGING_READ_ONLY, "true");
assert.equal(preview.vars.MUSE_AI_ENABLED, "false");
assert.equal(preview.vars.MUSE_PROJECT_GUIDE_ENABLED, "false");
assert.equal(preview.vars.NHS_APP_URL, REVIEW_PREVIEW_ORIGIN);
assert.equal(preview.vars.NEXT_PUBLIC_SUPABASE_URL, REVIEW_SUPABASE_ORIGIN);
assert.equal(production.vars?.NHS_STAGING_READ_ONLY, undefined);

const valid = { ...preview.vars };
const onPreview = (method, pathname="/", env=valid, hostname=REVIEW_PREVIEW_HOST) =>
  getStagingReviewDecision({ method, pathname, hostname }, env);

for (const method of ["GET","HEAD","OPTIONS"]) {
  assert.deepEqual(onPreview(method), { readOnly: true, blocked: false });
}
for (const path of ["/auth/sign-in", "/auth/sign-out"]) {
  assert.deepEqual(onPreview("POST",path), {readOnly:true,blocked:false});
}
for (const path of [
  "/", "/automations", "/leads/discover", "/projects", "/clients", "/forms",
  "/muse", "/api/admin/muse-ai", "/api/admin/muse-ai/project-plan",
  "/portal", "/auth/forgot-password", "/auth/reset-password"
]) {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.deepEqual(onPreview(method,path),{readOnly:true,blocked:true,status:405},method+" "+path);
  }
}
assert.deepEqual(onPreview("GET","/",{...valid,NHS_STAGING_READ_ONLY:"false"}),{readOnly:true,blocked:true,status:503});
assert.deepEqual(onPreview("GET","/",{...valid,NHS_STAGING_READ_ONLY:undefined}),{readOnly:true,blocked:true,status:503});
assert.deepEqual(onPreview("GET","/",{...valid,NHS_APP_URL:"https://app.ninthheartstudios.com"}),{readOnly:true,blocked:true,status:503});
assert.deepEqual(onPreview("GET","/",{...valid,NEXT_PUBLIC_SUPABASE_URL:"https://not-staging.supabase.co"}),{readOnly:true,blocked:true,status:503});
assert.deepEqual(onPreview("GET","/",valid,"app.ninthheartstudios.com"),{readOnly:true,blocked:true,status:503});
assert.deepEqual(onPreview("POST","/automations",{}, "app.ninthheartstudios.com"),{readOnly:false,blocked:false});

const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
assert.match(proxy,/getStagingReviewDecision/);
assert.match(proxy,/request\.nextUrl\.hostname/);
assert.match(proxy,/await supabase\.auth\.getClaims\(\)/);
assert.match(proxy,/review\.blocked/);
console.log("PASS Issue #71 source-only HTTP review barrier, stage DB ID, safe methods, blocked writes, auth exceptions and production isolation");
