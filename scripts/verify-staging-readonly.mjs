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
const onPreview = (method, pathname="/", env=valid, hostname=REVIEW_PREVIEW_HOST, hasNextActionHeader=false) =>
  getStagingReviewDecision({ method, pathname, hostname, hasNextActionHeader }, env);

for (const method of ["GET","HEAD","OPTIONS"]) {
  assert.deepEqual(onPreview(method), { readOnly: true, blocked: false });
}
// Review-mode auth callbacks are GET handlers with token-exchange side effects.
// They must not be included in the otherwise-safe GET/HEAD allow-list.
for (const method of ["GET","HEAD"]) {
  assert.deepEqual(onPreview(method, "/auth/callback"),
    {readOnly:true,blocked:true,status:405},
    "Review-mode auth callback must fail closed");
}
assert.deepEqual(onPreview("GET","/auth/callback",{}, "app.ninthheartstudios.com"),
  {readOnly:false,blocked:false},
  "Production callback behavior must remain untouched");
const callbackSource = readFileSync(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
assert.match(callbackSource, /exchangeCodeForSession/);
assert.match(callbackSource, /verifyOtp/);

for (const path of ["/auth/review-sign-in", "/auth/sign-out"]) {
  assert.deepEqual(onPreview("POST",path), {readOnly:true,blocked:false});
  assert.deepEqual(onPreview("POST",path,valid,REVIEW_PREVIEW_HOST,true),
    {readOnly:true,blocked:true,status:405}, "Next-Action dispatch must never traverse auth exemptions");
}
for (const path of [
  "/", "/automations", "/leads/discover", "/projects", "/clients", "/forms",
  "/muse", "/api/admin/muse-ai", "/api/admin/muse-ai/project-plan",
  "/portal", "/auth/sign-in", "/auth/forgot-password", "/auth/reset-password"
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
assert.match(proxy,/hasNextActionHeader:\s*request\.headers\.has\("next-action"\)/,
  "Proxy must pass action-dispatch header into staging request gate");
// Preview login is deliberately an ordinary HTML form to a stage-only Route
// Handler. The production form still uses the pre-existing Server Action.
const signInPage = readFileSync(new URL("../app/auth/sign-in/page.tsx", import.meta.url), "utf8");
const signInRoute = readFileSync(new URL("../app/auth/review-sign-in/route.ts", import.meta.url), "utf8");
assert.match(signInPage, /NHS_STAGING_READ_ONLY === "true"/);
assert.match(signInPage, /action="\/auth\/review-sign-in" method="post"/);
assert.match(signInPage, /action=\{signIn\}/);
assert.match(signInRoute, /export async function POST/);
assert.match(signInRoute, /getStagingReviewDecision/);
assert.match(signInRoute, /request\.headers\.get\("origin"\) !== REVIEW_PREVIEW_ORIGIN/);
assert.match(signInRoute, /request\.headers\.has\("next-action"\)/);
assert.match(signInRoute, /application\/x-www-form-urlencoded/);
assert.match(signInRoute, /!decision\.readOnly \|\| decision\.blocked/);
const signOutRoute = readFileSync(new URL("../app/auth/sign-out/route.ts", import.meta.url), "utf8");
assert.match(signOutRoute, /getStagingReviewDecision/);
assert.match(signOutRoute, /hasNextActionHeader:\s*request\.headers\.has\("next-action"\)/);
assert.match(signOutRoute, /review\.readOnly/);
assert.match(signOutRoute, /request\.headers\.get\("origin"\) !== REVIEW_PREVIEW_ORIGIN/);
assert.match(signOutRoute, /request\.headers\.get\("sec-fetch-site"\) !== "same-origin"/);
assert.deepEqual(onPreview("POST","/auth/sign-out",valid,REVIEW_PREVIEW_HOST,true),
  {readOnly:true,blocked:true,status:405}, "Cross-route action dispatch must fail closed");
assert.deepEqual(onPreview("POST","/auth/sign-in"),{readOnly:true,blocked:true,status:405});

console.log("PASS Issue #71 staging-only Route Handler auth guard, action bypass rejection, source-only HTTP barrier, stage isolation");
