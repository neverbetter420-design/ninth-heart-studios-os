# NHS OS Muse: isolated Cloudflare preview release gate

**Status:** Source-only preparation on draft PR #67. **No online preview has been deployed or authorized.** This is an operational safety checklist, not permission to merge, migrate, pay for anything, or deploy.

## Verified baseline (2026-11-01 PT)

- Source: `neverbetter420-design/ninth-heart-studios-os`, `review/muse-62-64-integrated-main-20261101`.
- At this review: `main` = `cf58845a61f4eb6c0d46e67cd10fefbd0e0a54bd`, combined Muse head = `44a8af37f78deb4245eaa9f65380eec46b198d11`.
- All **nine GitHub Actions checks passed** on that combined head, including disposable local Supabase Auth/RLS, desktop/mobile Chromium, and the **credential-free OpenNext preview dry-run**.
- Current connected Cloudflare Worker: `ninth-heart-studios-os`. **Do not modify** its live scripts, routes, variables, tokens, deployments, or Git build connection under this review.
- Its existing Workers Builds configuration identifies the **review branch as the production build branch**, has `previews_enabled=false`, and uses `npm run build` then `npx wrangler preview`. The Cloudflare automatic build failed because `npm run build` only executes `next build`, while `wrangler.jsonc` expects `.open-next/worker.js`.
- No successful live Worker deployment was observed from that failed build. The latest observed live deployment predates this PR.
- Cloudflare documents that switching existing connected Workers to the newer Worker Previews model is **one-way** and Preview URLs are **public by default**. Do **not** turn previews on for the production Worker as a shortcut.

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
