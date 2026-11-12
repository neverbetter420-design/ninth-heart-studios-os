# Issue #71 | Stage-only database write-freeze plan (REVIEW ONLY)

**Status:** source-only proposal attached to draft PR #72. **NOT APPLIED.**
**Supabase project:** `nhs-os-staging-preview` / project ID
`qihwmfwlhsetxwggaesd`, URL `https://qihwmfwlhsetxwggaesd.supabase.co`.
**Never target:** studio Supabase project `ninth-heart-studios-os` /
`rquscwgdrqkzwjukiqtk`, production Worker `ninth-heart-studios-os`,
or production branch. Use only the separate project-ID-scoped Supabase
connection for future SQL; a Postgres DB name such as `postgres` is not a
reliable staging discriminator.

## Actual metadata baseline (read-only query, 2026-11-11)

| Surface | Verified stage-only baseline |
| --- | --- |
| `public` | 32 ordinary tables, RLS on all 32 |
| `authenticated` table privileges | SELECT 32/32, INSERT 32/32, UPDATE 32/32, DELETE 31/32 |
| `anon` table privileges | INSERT grant on 19/32, with RLS still enforcing its policies |
| `public` executable functions | Six executable by `authenticated`, none by `anon`; two trigger helpers are not directly executable by either |
| Storage | `storage.objects`, `storage.buckets` and `storage.buckets_analytics` grant writes to `authenticated` |
| Storage policies | Six `storage.objects` policies include admin manage, client upload/delete, and read rules |
| Default ACL | Both `postgres` and `supabase_admin` currently grant public-table writes by default |
| Schemas | Neither `anon` nor `authenticated` has CREATE privilege on `public`, `storage`, or database |
| Data | No staging clients, memberships, projects, leads or prospects; 5 automations off with no previous runs |

Existing RLS is necessary for normal operations but **is not a stage-wide
write-freeze**. The Next Proxy barrier in PR #72 covers Next.js HTTP methods,
not direct browser Supabase REST/Storage/RPC requests. A separate grant-level
freeze is required for a trustworthy interactive read-only acceptance mode.

## Exact readiness acceptance query (observational)

`scripts/sql/issue71-staging-readonly-acceptance.sql` is a separate,
**SELECT-only** diagnostic to be run against project ID
`qihwmfwlhsetxwggaesd`, **never production**, before and after any
separately approved stage-only privilege freeze.

**Verified baseline (Nov 11, 2026):** `app_tables=32`,
`missing_rls=0`, `missing_admin_reads=0`,
`writable_app_tables=32`, `exposed_public_rpcs=6`,
`writable_storage_tables=3`, `future_public_write_grants=36`.
Therefore `staging_read_only_ready=false` **by design** at present.

The boolean is a conservative **necessary** acceptance check, not proof
of comprehensive read-only security. It does **not** cover auth triggers,
all Storage edge paths, privileged service-role operations, external API
calls, side-effectful GET handlers, or accidental deployment to the
wrong Worker. Those require separate review and authorization.

## Staging ACL snapshot / rollback readiness (source-only)

The file `scripts/sql/issue71-staging-acl-snapshot.sql` captures raw ACLs,
object names/signatures, object owners, schema ACLs, default ACLs, API-role
memberships, and RLS policies using six catalog SELECT statements only.
It does not generate or execute any DDL, and does not freeze the database.

Before any **separately approved** staging-only permission mutation:

- Confirm the target project **ID** in the connected Supabase project picker.
  Never infer it from `current_database()` (often just `postgres`).
- Preserve the full snapshot output privately, retaining raw NULL ACLs rather
  than silently substituting default or empty privilege strings.
- Re-run this snapshot immediately before changes, compare with the approved
  baseline and stop on any drift; capture the exact object identities/owners.
- Draft and independently review reversible statements derived from the
  captured ACLs. Do not use broad `GRANT ALL` or place any ACL DDL in common
  `supabase/migrations` that could reach production.
- Verify the post-change effective privileges separately; do not treat the
  existence of a snapshot as proof that a restore will work.

## Auth POST exception: source mitigation prepared, hosted test outstanding

The old review-mode pathname exception for the `/auth/sign-in` Server Action
has been removed in PR #72. In review mode, the login page displays a
**native form** posting to the new stage-only Route Handler
`POST /auth/review-sign-in`; production still uses the pre-existing sign-in
Server Action. The review Proxy now denies the original sign-in POST path and
rejects any `Next-Action` header even on permitted sign-in/sign-out routes.
The dedicated review route also requires strict same-origin and form-type
checks, validates input lengths, and refuses operation without the exact
preview configuration.

This is **source-only mitigation, NOT a tested deployed security guarantee**.
The compiled Worker and hosted login flow still need separate validation:
- Confirm the native form posts to the correct route in the protected preview.
- Confirm valid admin sign-in, inactive-user rejection, and sign-out.
- Confirm that action POSTs addressed to each auth path fail with 405.
- Confirm foreign-origin/missing-origin requests and incorrect content types
  fail with 403 on the dedicated sign-in handler.
- Confirm missing or mismatched review flags/host/DB URL fail closed with 503.
- Confirm no unauthorized direct Supabase Data API, RPC or Storage writes.
Do not send hosted mutation probes, create accounts, or deploy without separate
owner authorization. The stage-only database write-freeze remains required.

## Proposed change, requiring additional explicit permission

1. **Preflight:** verify project ID/name/URL, repeat the metadata audit in
   `scripts/sql/issue71-staging-acl-audit.sql`, and capture the **exact**
   object and default privilege ACLs for a deterministic rollback. Halt if
   there is drift or a mismatch. Do not infer project identity from the
   `current_database()` value.
2. **Preserve read access:** do not revoke SELECT permissions used by the
   Admin visual routes, or auth-required functions. Maintain RLS.
3. **Stop ordinary Data API writes:** within a stage-project-only reviewed
   transaction, remove authenticated/anonymous INSERT, UPDATE, DELETE and
   other mutation privileges from the stage `public` application tables.
   Explicitly audit effective privileges after the change, including grants
   inherited through PUBLIC or roles.
4. **Stop RPC write bypasses:** remove caller EXECUTE on the six mutable
   stage `public` RPC functions:
   `apply_muse_project_plan(uuid)`,
   `cancel_deep_scan_job(uuid)`,
   `claim_deep_scan_batch(uuid)`,
   `finish_deep_scan_batch(uuid,uuid,integer,integer,integer,integer,integer)`,
   `pause_deep_scan_batch(uuid,uuid,text)`, and
   `renew_deep_scan_batch(uuid,uuid)`. Preserve internal trigger behavior
   for `handle_new_user()` and `set_updated_at()`.
5. **Stop Storage writes:** independently assess and prevent authenticated/
   anonymous uploads, overwrites and deletes to the relevant Storage
   objects/buckets while keeping intended reads available. Review grants
   and six existing Storage policies; **do not blanket-remove internal
   service-role privileges** or replace the Storage schema's policies
   without product-specific validation.
6. **Guard newly created objects:** revise the staging project's
   `public` default ACL for both identified object creators,
   `postgres` and `supabase_admin`, so future app tables and functions
   are not automatically write-exposed. Review `storage` defaults
   separately, with Storage product compatibility confirmed.
7. **Verify:** repeat the catalog audit, check that every ordinary
   `authenticated`/ `anon` write grant on app tables is absent,
   mutable RPC EXECUTE absent, and storage writes denied. Confirm intended
   authenticated SELECTs and login still work. Audit roles and
   `SECURITY DEFINER` paths. Verify no external calls can be triggered.
   Never run a hosted write test without separate test-only authorization.
8. **Rollback only if necessary:** restore the **captured exact ACLs** in
   a stage-only transaction, not a blanket `GRANT ALL`. Recheck the
   original role capabilities and baseline. Keep production untouched.

## Prohibited shortcut

Do **not** put these privilege changes in `supabase/migrations`, which may
later be promoted to production. Do not execute grant/revoke DDL as part of
CI, run SQL from a browser, create test accounts, or alter stage grants
until a separately scoped owner approval is recorded.

## Existing review acceptance

- PR #72's fail-closed HTTP barrier is **source-only, unmerged and undeployed**.
- All nine workflow outcomes at prior head: seven successful and two
  intentionally skipped (when last checked). Subsequent commits must rerun.
- Cloudflare Access remains account-member protected; Muse AI and Guide OFF.
- Live 320/390px staging visual acceptance is pending. Client A/B hosted
  account checks are **owner-deferred, not PASSED**.

### Reference
- [Supabase Data API grants + RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase RLS reference](https://supabase.com/docs/guides/database/postgres/row-level-security)

**Decision:** inspect and review only. No staging database change in this PR.
