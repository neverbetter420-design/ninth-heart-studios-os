# Issue #71 | Protected staging review HTTP barrier

This change is **source-only** on an independent draft branch based on PR #70.
It has NOT been deployed, and does NOT modify the current protected preview,
its Supabase database, or production.

## Mechanism
- The Next.js 16 `proxy.ts` checks the exact protected staging hostname.
- The preview is allowed to render only when `NHS_STAGING_READ_ONLY=true`,
  `NHS_APP_URL` matches the protected preview URL, and
  `NEXT_PUBLIC_SUPABASE_URL` matches the existing staging Supabase project.
- Safe `GET`, `HEAD`, `OPTIONS` pass. All ordinary mutating HTTP
  methods, including server-action `POST` to automation/scanner pages and
  Muse AI routes, return 405 with a no-store response.
- `POST /auth/sign-in` and `POST /auth/sign-out` remain allowed to let
  reviewers authenticate. These are explicit exceptions. Do not claim the
  gate protects arbitrary server actions via a misrouted auth request.
- A preview with a missing/mismatched flag, URL, hostname or database
  project fails closed with 503. Production routes with no preview flag
  continue unchanged.
- Supabase session refresh still runs for permitted requests.

## What this DOES NOT protect
1. **Direct Supabase Data API or Storage writes from browser code.** These
   bypass the Next.js Proxy. Database-level grants/RLS or an isolated
   review credential must provide enforcement before any stateful QA.
2. Any state-changing `GET` route or mutation hidden behind an auth
   exception. Review and eliminate such paths before enabling broad use.
3. External network actions from any endpoint beyond the proxy's reach.
4. Local offline tests are not proof of hosted Cloudflare routing behavior.

## Test gate, rollout constraints
- CI `scripts/verify-staging-readonly.mjs` checks stage-only host, DB ID,
  both Wrangler var scopes, Muse OFF, allowed methods, blocked actions,
  fail-closed cases and production noninterference.
- DO NOT merge this draft, update PR #70 release workflow, or publish
  the new Worker until a separate, explicit staging-only authorization
  and complete review (including impact on login).
- Existing PR #70 one-shot staging workflow is intentionally pinned to
  the prior approved SHA and original exact config, and MUST NOT be
  retriggered as a way to publish this proposed change.
- Client A/B hosted coverage remains **deferred by owner, not passed**.
- Existing protected preview stays available for GET-only design checks.
