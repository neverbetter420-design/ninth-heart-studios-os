# NHS OS production release preflight — October 17, 2026

**Status: HOLD / NO PRODUCTION WRITES AUTHORIZED.** Draft PR #14 remains open and unmerged. This is a release checklist, not authorization to migrate, merge, publish, enable workflows, reset accounts, or change real data.

## Verified current baseline

- Repo: `neverbetter420-design/ninth-heart-studios-os`; proposed branch: `feature/working-navigation-client-portal`.
- Active Supabase project: `rquscwgdrqkzwjukiqtk`, PostgreSQL 17.11. Only active hosted Supabase project was accessible at inspection time.
- Supabase applied migration-history versions: **22**. Exact 22 historical SQL versions now exist in the draft branch. The previously missing `20261014060417_fix_form_source_policy_object_path.sql` was restored by reading the **existing production migration record** and checking the current storage policy. This file must **not** be manually rerun in production.
- Proposed new migration: `20261017030000_phase3_client_decision_sender_guard.sql`. **Not installed in active Supabase** (approval trigger absent; message sender-policy still lacks `sender_id=auth.uid()`).
- Existing Client A and B test fixtures at last verification: each **2 tasks, 1 membership, 1 approval, 0 messages**; QA storage leftovers **0**. Do not modify those approvals to test migration.
- Cloudflare account Worker: `ninth-heart-studios-os` and custom domain `app.ninthheartstudios.com`. Last observed Worker deployment **2026-10-16 20:04:57 UTC**, deployment ID `0e20b4f7-9e88-4875-b7ae-732d4ee2baab`, version ID `b3b1f4ec-9859-4407-b0dd-f28322b68337` at 100%. Read-only Worker settings exposed the `ASSETS` and `NEXTJS_ENV` bindings, compatibility date `2026-10-01`, `nodejs_compat`. This is a **rollback reference**, not proof that rollback is configured or that a previous version is currently healthy.
- PR #14 security test coverage: local isolated PostgreSQL 17, complete local Supabase migrations/Auth/PostgREST with **9/9** API cases, desktop/mobile portal UI including hostile cross-client form fields **2/2**, ordinary Playwright, TypeScript/application verification, Cloudflare Worker build and dry run. These results demonstrate local behavior, not post-deployment behavior.
- Repeatable source preflight: `npm run verify:release-preflight`, run as part of `.github/workflows/verify.yml`; refuses missing applied migrations or removal of manual Cloudflare deployment guards.

## Latest completed draft-branch verification

GitHub CI on reviewed source commit `42d6279e346a9b7427a6a127385d112d971e3890` has completed successfully: [full local Supabase #39046904876](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39046904876) (9/9 Auth/API security cases plus 2/2 desktop and mobile portal UI tests); [application #39046904895](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39046904895); [ordinary browser #39046904873](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39046904873); [Cloudflare bundle dry run #39046904878](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39046904878); and [isolated PostgreSQL #39046904920](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39046904920).

An earlier [local Supabase UI run #39046519493](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39046519493) failed on transient message error feedback after approval page revalidation. `tests/e2e/phase3-local-ui.spec.mjs` now waits for the approval view to settle and reloads before attempting a negative message submission. The corrected run passed both device scenarios, but this does not guarantee the UI is entirely free from concurrent revalidation edge cases. Keep an eye on live error feedback after rollout.

**Important:** The above evidence is from synthetic CI data, not live production application verification. The final runbook/guard edits that follow the verified code commit must receive their own CI verification before the final release.

## Release dependency order

### Gate 0 — Validate external delivery and rollback capability (not verified yet)

- [ ] **Confirmed Free-plan backup gap (October 17):** Supabase project has no included downloadable automatic backups. Live read-only inventory: ~13 MB database, 4 Auth users, 1 Storage object and 22 applied migrations. Create an encrypted **manual logical backup including Auth/migration-history coverage**, preserve the sole Storage object's file bytes separately, and document a viable restore; or obtain explicit authorization for a paid upgrade and verify a backup. Follow `docs/EMAIL_AND_FREE_PLAN_RELEASE_GATE_2026-10-17.md`. A backup status alone is not proof of a working restore.
- [ ] Confirm the GitHub `production` environment has required reviewers/approval protection; the workflow's `environment: production` line **does not prove** reviewers are configured. Verify in GitHub Settings UI.
- [ ] Confirm Cloudflare API deployment token is stored in GitHub `production` environment; never paste credentials into chat, source, actions logs, or the app frontend.
- [ ] Resolve **email DNS launch blocker** using `docs/EMAIL_DNS_GO_LIVE_FIXES.md`: Cloudflare zone lists 3 DMARC TXT records plus a CNAME at `_dmarc.ninthheartstudios.com`, and an Amazon inbound MX alongside Google Workspace MX. Confirm Wix/SES ownership and obtain separate DNS approval; preserve Google mail delivery. Then verify one valid DMARC policy and expected MX.
- [ ] Verify Resend transactional sender/domain, Supabase SMTP, auth redirect allow-list, and password-recovery email delivery with a controlled mailbox. Do not infer delivery from existing DNS records, HTTP 200 or `mail.send` alone.
- [ ] Decide explicitly whether a separate hosted Supabase staging project is required. A disposable full-stack local Supabase stack **has** passed; no billable hosted staging project was created.

### Gate 1 — Approve ONLY the database security migration (separate authorization)

- [ ] Obtain explicit approval for `20261017030000_phase3_client_decision_sender_guard.sql` on project `rquscwgdrqkzwjukiqtk`.
- [ ] Freeze and record the exact Git commit hash and migration file hash.
- [ ] Take pre-change snapshots of `pg_policies` for `public.approvals` and `public.messages`, and existing approval triggers/functions. Capture counts for the two synthetic test fixtures; no customer write probes.
- [ ] Apply ONLY the single approved new migration, via migration-aware tooling, in a tracked transaction as supported by provider. Do not replay historic applied migrations or reset the database.
- [ ] **Read-only post-check:** `zz_guard_client_approval_decision` trigger exists and is enabled; `private.guard_client_approval_decision` exists; client approval UPDATE policy includes `decided_by=auth.uid()`; client message INSERT policy includes `sender_id=auth.uid()`; both tables retain RLS, original customer data/counts remain stable; no unintended changes to admin policies.
- [ ] If any check fails, **STOP** and avoid app deployment. Investigate and prepare a narrow forward fix.

### Gate 2 — Approve PR merge (separate authorization)

- [ ] Verify all CI checks green on **exact** frozen PR head: application, Cloudflare dry-run, ordinary browser, PostgreSQL synthetic role test, full local Supabase Auth/API and desktop/mobile UI test, source preflight.
- [ ] Review PR diff, migration provenance, permissions, client navigation, and release notes.
- [ ] Verify `main` and the proposed merge commit correspond to the approved reviewed change. Do not merge without approval.

### Gate 3 — Approve Cloudflare publish (separate authorization)

- [ ] Confirm database security post-check passed, recovery email is deliverable, approved `main` SHA is frozen, and production GitHub environment reviews are in force.
- [ ] Record current Cloudflare deployment/version ID and Worker settings immediately before publish.
- [ ] Trigger `Deploy NHS OS to Cloudflare (manual)` on **main** only after explicit approval; do not rely on automatic push workflows. The draft version of this workflow adds a fail-closed owner-only gate requiring exact `approval_phrase=I_APPROVE_NHS_OS_PRODUCTION_DEPLOY`, exact `expected_main_sha` matching the current approved 40-character commit, and `verified_security_migration=I_VERIFIED_SUPABASE_HARDENING` after independently verifying the active policies. These are manual human attestations, **not** substitutes for actual migration/backup/email checks. This workflow gate only takes effect when the reviewed source reaches `main` after separate merge approval.
- [ ] Verify Worker deployment ID/version and app custom domain, `ASSETS` and `NEXTJS_ENV` bindings, compatibility flags and secret presence (names/types only, never values).

### Gate 4 — Post-deploy smoke and monitoring

- [ ] Test **admin** login, dashboard/menu navigation, lead list/scanner entry point, project workspace, form loading and password reset with a controlled account.
- [ ] Test **Client A and B** login, own-only navigation, cross-client direct project URL denial, and client-visible data segregation on desktop and mobile.
- [ ] Test approvals/messages end to end only on **separately approved disposable records**; do not approve an existing customer's pending request or send messages to a customer.
- [ ] Test private file upload/download/deletion on an approved disposable test project, with scoped cleanup proof.
- [ ] Inspect Cloudflare Worker errors/status, Supabase Auth failures, transactional email accepted/delivered events, and any unexpected approval/message denials.

## Failure / rollback containment

**Do not restore the older permissive client approval/message policies as a casual rollback.** Those were the security defects this release fixes.

- If migration fails: freeze deployment. Keep the old Worker and determine a narrow migration forward fix. If the new policies have partially applied and client writes appear unsafe, a separate approved **fail-closed** database containment change can disable only client approval-decision/message-INSERT policies while keeping read-only access and administrator policies; obtain explicit approval before any SQL changes.
- If Worker deploy fails: use Cloudflare's audited Worker deployment history to restore the previously recorded known-good Worker version after explicit authorization, while **keeping the more restrictive database security rules**. Check that the older Worker remains compatible before rollback. Do not automatically roll back passwords, email settings or the database.
- If post-deploy smoke fails: stop testing against customer accounts, document exact error, preserve logs, and decide between a Worker-only rollback and a tested forward fix.
- No scripts in this runbook perform mutation. **No rollback or release action has been executed.**

## Remaining release blockers as of the preflight

1. Explicit owner authorization for the active-project migration, PR merge, and Worker deploy.
2. Verified restorable database backup and GitHub production-environment reviewer configuration.
3. Resolve conflicting DMARC records, clarify Google Workspace/AWS MX ownership, and verify actual recovery-email delivery and cross-device reset behavior.
4. Production post-migration verification and post-deploy smoke testing, necessarily deferred until those steps are separately authorized.

The additional source-history migration was restored only to the unmerged draft PR; it is already applied on the live database.
