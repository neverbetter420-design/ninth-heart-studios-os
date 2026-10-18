# NHS Nocturne staging readiness — October 18, 2026

**PREPARATION ONLY. No preview Worker has been deployed. No production schema, users, Storage objects, or settings have been changed.**

## Verified facts

- Source: draft PR #14, `feature/working-navigation-client-portal`.
- Production Supabase (`rquscwgdrqkzwjukiqtk`) has **22** applied migration versions, not 23. The source preflight expects those 22 plus one proposed/unapplied security migration: `20261017030000_phase3_client_decision_sender_guard.sql`. Do not replay applied versions or apply this pending migration on production without separate approval.
- The default `main` record from the Supabase branching API reports `MIGRATIONS_FAILED` in branching metadata, whereas the production project is `ACTIVE_HEALTHY` and the applied migration history is available. This status alone does **not** prove production migration failure or authorize resetting/rebasing the default branch. Recheck provider branch diagnostics before provisioning a hosted preview.
- The synthetic, disposable local Supabase workflow already replays the migrations and tests real Auth/API and desktop/mobile views. Its visual artifact is `nhs-nocturne-atelier-visual-review` (56 PNG captures from 28 views), on the local Supabase workflow of the reviewed PR commit.
- The current live Cloudflare Worker remains `ninth-heart-studios-os`. The distinct config `wrangler.nocturne-preview.jsonc` is not referenced by the production release workflow.

## Source-level preview isolation

`wrangler.nocturne-preview.jsonc` deliberately specifies:

- Worker name `nhs-os-nocturne-preview` (never `ninth-heart-studios-os`);
- `workers_dev: true` and `routes: []`, with no custom production domain;
- `keep_vars: false`, no inherited secrets, database bindings, triggers, or environment overrides;
- the same OpenNext artifact and static-assets binding as the production build.

`scripts/verify-release-preflight.mjs` checks these invariants on every normal PR verification workflow. The presence of this file does not create a Worker or authorize deployment.

## Gates before a hosted preview is permitted

1. **Provider costs and access:** Confirm the organization, billing/compute implications, and an appropriate plan before creating a Supabase preview branch or project. Do not create a charged resource without explicit owner agreement. There is no hosted staging database yet.
2. **Dedicated Supabase:** Use a *separate* project/branch with its own `NEXT_PUBLIC_SUPABASE_URL` and publishable key. Reject any build targeting production ref `rquscwgdrqkzwjukiqtk`. Review/reconcile preview migration history and test with synthetic fixtures only. Never copy production Auth users, client data, or Storage files.
3. **Auth and email:** Configure preview Site URL, approved redirect URLs and `NHS_APP_URL` for the **actual** staging hostname. Review password-reset email templates to ensure links cannot take a staging tester to production. Use controlled QA inboxes; do not reuse production SMTP secrets, customer addresses, or recovery tokens.
4. **Worker runtime secrets:** Configure preview bindings in a separately reviewed deployment context. Inspect both build-time `NEXT_PUBLIC_` values and runtime environment settings. Do not ship a Worker that falls back to the production application URL or project.
5. **Deployment authorization:** Obtain explicit approval for a *staging-only* deployment. Build from the exact reviewed PR SHA and run a dry run using `npx wrangler deploy --dry-run --config wrangler.nocturne-preview.jsonc`. Inspect the resolved Worker name, route list and runtime bindings before any publish. Never run the ordinary `npm run cf:deploy` against a preview because it uses the production Wrangler configuration.
6. **QA and release:** Verify isolated admin, Client A and Client B sign-ins, permission boundaries, navigation, messages/files on synthetic records, and screenshots at desktop/mobile widths. Visual approval remains separate from production migration, PR merge, backups, and Cloudflare production release approval.

## Immediate review alternative

The **existing** local-Supabase visual artifact provides 56 screenshots. Use it for design feedback without creating a hosted staging Worker or database. Screenshot tests do not verify hosted services, authenticated production actions, or a working staging domain.

## Prohibitions

Do not reset, repair, rebase, or merge the default Supabase branch to hide its metadata status. Do not replay applied production migrations. Do not merge PR #14, deploy the live Worker, activate automations, change DNS/email, reset users, or run write probes against customer data as part of staging preparation.
