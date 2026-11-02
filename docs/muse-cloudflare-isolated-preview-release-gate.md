# NHS OS Muse: isolated Cloudflare preview release gate

**Status:** Source-only preparation on draft PR #67. **No online preview has been deployed or authorized.** This is an operational safety checklist, not permission to merge, migrate, pay for anything, or deploy.

## Verified current state (read-only, November 2, 2026 PT)

- Source: `neverbetter420-design/ninth-heart-studios-os`, draft branch `review/muse-62-64-integrated-main-20261101`. GitHub `main` remains `cf58845a61f4eb6c0d46e67cd10fefbd0e0a54bd`. Do not merge this draft or deploy either branch.
- GitHub's nine checks passed on Muse review head `de6d84b1f8f7aa28a1f3656cec726c5491f54886`, including disposable Supabase auth/RLS, desktop/mobile browser tests, and the **credential-free OpenNext dry-run**. The newer source-only safety-check commits must pass checks on their own exact head; prior success is not transferable.
- Cloudflare's connected production Worker is **`ninth-heart-studios-os`**, last observed deployed on **October 31, 2026 at 08:21:22 UTC**. That production deployment is separate from the current Muse draft.
- **Current Cloudflare Workers Builds settings (verified via read-only API November 2):** Git repository branch is `main`; `auto_build_enabled=false`; `previews_enabled=true`. The production command is `npm run build` then `npx wrangler deploy`. The connected preview command is **`npm run build` then `npx wrangler preview`**. A historical note saying the production branch is this review branch, or that previews are disabled, is no longer accurate.
- Cloudflare's automatic preview for exact Muse commit `de6d84b1f8f7aa28a1f3656cec726c5491f54886` **failed November 2 at 09:39 UTC**. Deployment logs state: `The entry-point file at ".open-next/worker.js" was not found.` Plain `next build` does not generate the Worker bundle that Wrangler expects. This is a **connected Cloudflare preview configuration issue**, not evidence that the separate GitHub OpenNext dry-run failed.
- **Do not repair this by editing the production-linked Worker's build settings or triggering a deployment without separate authorization.** Cloudflare preview URLs may be public by default, and enabling/disabling preview capability on an existing connected Worker can have operational consequences. Successful offline CI does not authorize online preview publication.
- No live Worker, routing, build configuration, hosted Supabase data, Muse flag, AI credential, or paid service was changed by this source-only review.

## November 2, 2026 Cloudflare preview-configuration correction (owner-authorized)

The owner requested that Cloudflare be fixed. A **targeted Cloudflare Workers Builds Preview settings patch** was applied only to the existing Muse review-branch preview `16c83a9d6ccf44e6b3ea49bf7430a9bb` under production-connected Worker `ninth-heart-studios-os`:

- `auto_build: false`, to stop accidental online preview publication when pushing review commits.
- `settings.build_command: "npm run cf:build"`, generating the required `.open-next/worker.js` instead of only compiling Next.js.
- `settings.deploy_command: "npx wrangler preview --config wrangler.nocturne-preview.jsonc"`, explicitly selecting the inert, independently named, no-production-route review config if a separately approved preview is ever published.
- A read-back verified these exact values. Cloudflare's **production settings, production Git branch, automatic production-build policy and live Worker deployment ID were unchanged**. This operation did not trigger a build, deploy a Worker or expose a Preview URL.
- This change is scoped to **one existing review-branch Preview**. It does not fix historical failed runs, other Previews or the production build command, which intentionally remain out of scope. A successful hosted preview deployment has **not** been demonstrated. The preview command's end-to-end compatibility with the separate Worker name still requires a reviewed, safely access-controlled online test before enabling `auto_build`.

The historical failing automatic-preview settings below are retained as incident evidence, not as current configuration. Do not turn automatic preview publishing back on merely because offline CI passes.

## Approved-for-CI offline verification (already implemented)

The review branch has an isolated, independently named config: `wrangler.nocturne-preview.jsonc`. Its Worker name is `nhs-os-nocturne-preview`, not `ninth-heart-studios-os`. It has no routes, `keep_vars=false`, inert Supabase placeholders, and no AI, ratelimit, KV, R2, D1, or service bindings. The synthetic-only placeholders are explicitly configured **twice**: in top-level `vars` (required if a separately approved standalone preview Worker is ever published with `wrangler deploy`) and in `previews.vars` (required for Worker Preview deployments). Cloudflare does **not** inherit these variables across the two modes. Both maps are required to match exactly by the offline safety test.

The credential-free job `.github/workflows/muse-isolated-preview-dry-run.yml` executes:

```sh
npm ci
node scripts/verify-muse-isolated-preview.mjs
npm run cf:build
node scripts/verify-muse-isolated-preview.mjs --require-bundle
npx wrangler deploy --dry-run --config wrangler.nocturne-preview.jsonc
```

This produces and validates `.open-next/worker.js` **without publishing**. The job deliberately receives no Cloudflare, hosted Supabase, or AI-provider credentials. It is evidence about bundle compatibility, not online deployment.

## Preview exposure audit and owner-controlled Access setup (November 2, 2026)

A read-only inventory of **all 64** Preview build configurations on the production-connected Worker found **63 with `auto_build=true`** and only the corrected Muse branch with `auto_build=false`. The 63 were **not** changed. All 64 Preview build histories were inspected; **three branches recorded a successful Worker Preview deployment**:

| Branch | Last known successful build | Read-only anonymous probe |
| --- | --- | --- |
| `fix/cloudflare-preview-isolated-bindings` | November 1, 2026 | Public URL responds with HTTP 500; no private data was requested |
| `release/nocturne-atelier-nhs-os-20261018` | October 20, 2026 | Returned a login-required result |
| `design/nocturne-atelier-implementation-20261018` | October 20, 2026 | Returned a login-required result |

The other **61** branches had **no successful deployment in the inspected build histories**. A successful build means a Preview URL was issued in the logs; it does not prove that the URL is currently working or exposing data. These URL probes **do not establish** protection by Cloudflare Access: the Access apps API returned `403 access.api.error.not_enabled`, explicitly indicating that **Zero Trust / Access is not enabled for this Cloudflare account**. An application login screen is not a substitute for account-edge Access rules.

### Owner-controlled dashboard setup: preview-only, never production

1. Open [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) and choose the current account. If prompted, initialize **Zero Trust / Access** only after reviewing the offered plan and confirming there is **no paid commitment**. Do not add a payment method or choose a paid tier without separate approval.
2. In **Workers & Pages**, locate **Protect all Workers**. Choose **Previews only**, *not* all production Worker traffic, or select the specific NHS Worker and **Settings → Domains & Routes → Preview URLs → Enable Cloudflare Access**, where available. Production `app.ninthheartstudios.com` must remain publicly reachable for its normal login.
3. Set the preview policy to **Allow only the owner/admin identity** (an explicit email or existing Cloudflare account membership), deny other identities, and retain a normal authenticated sign-in challenge. Do not allow **Everyone**, wildcard domains, or bypass rules. Confirm that no policy applies to production routes.
4. **Verify before publishing**: an anonymous request to an existing Preview URL must be blocked or challenged by Cloudflare Access **before the Next.js application runs**. Repeat with the approved owner login and check that it succeeds. Verify production login is unaffected.
5. Only after verifying edge protection, request separate approval for **one exact preview branch and SHA**. Confirm no production bindings or database keys are attached. Keep `MUSE_PROJECT_GUIDE_ENABLED=false` and `MUSE_AI_ENABLED=false`. Begin with manual build, **not** branch-wide auto-build.
6. Inventory all existing successful Preview deployments again and decide whether to keep, disable, or delete the legacy three. Do **not** bulk-delete 64 configurations, update every Preview via `patch_existing_previews=true`, re-enable `auto_build`, or change global `previews_enabled` without a separate scoped decision.

**Current release state:** No Access initialization, policy change, online Preview publication, new credential, paid service, production deployment, route change, or deletion was performed by this investigation. Cloudflare preview builds for the Muse branch remain disabled.

## Before any online preview (NOT approved yet)

1. **Keep the existing production Worker and its Git connection untouched.** Do not patch its `git_repository.branch`, production build/deploy command, `previews_enabled`, or trigger. These are operational settings on a production-linked resource.
2. Prefer a **separately named, disposable preview Worker/build connection**. Only connect the exact reviewed branch/commit after independently verifying the separate destination, ownership, no production routes, and no unintended auto-deploy triggers. Do not target `ninth-heart-studios-os` or re-use its deployment token. A new environment must use least-privilege credentials scoped to the separate preview.
3. **Lock down access before publishing.** Cloudflare Worker Preview URLs can be publicly reachable. Require authenticated preview access (for example Cloudflare Access) and explicit authorization for any publicly routable `workers.dev` endpoint; never include real client records, production login cookies, API tokens, or a real Supabase project in such a preview.
4. Use inert test values by default. To test full login/project behavior, request separate permission for an **ephemeral staging Supabase project**, seeded only with synthetic users and data. Existing `https://example.supabase.co` placeholders intentionally do **not** support working authentication.
5. Keep `MUSE_PROJECT_GUIDE_ENABLED=false` and `MUSE_AI_ENABLED=false`. Do not supply `OPENAI_API_KEY` or other paid provider credentials, and do not run scans, outreach, customer messages, or live task creation. No hosted schema migrations.
6. Check Cloudflare plan/free-tier resource availability and whether deploying a new Worker or Access configuration causes any charge before approving an online step.
7. For any separately approved online preview, the correct **build stage** is `npm run cf:build`, not plain `npm run build`. Any publishing command requires a separate explicit owner approval identifying **the exact preview Worker, commit SHA, branch, expected public/private URL behavior, and resources**.
8. After an authorized preview, verify the live Worker's deployment ID/version, routes, settings, bindings, and production `main` are unchanged. Tear down the disposable preview after review, with separate permission to delete any external resources.

## Mandatory release gates (still open)

- Read-only security review of the privileged functions/RLS and candidate SQL `supabase/migration-candidates/20261031214507_muse_plan_revision_ledger_v2.sql`. The hosted production migration inventory must not change in this preview task.
- Separate explicit approval for any **merge**, **hosted database migration**, **production deploy**, **feature activation**, or **paid service**.
- An offline CI success, a Cloudflare preview URL, and a green GitHub PR check do **not** authorize one another.

## Official references

- Worker Previews and default public access: https://developers.cloudflare.com/workers/previews/
- One-time switch for existing connected Workers: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#existing-workers-connected-to-builds
- Isolated preview resource considerations: https://developers.cloudflare.com/workers/previews/resources/
- Preview configuration and variables: https://developers.cloudflare.com/workers/previews/configuration/
