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
| Explicit column ACLs | 0 on staging public/storage relations as of the read-only audit |
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

### Expanded readiness coverage (source-only, 2026-11-13)

The acceptance query now uses PostgreSQL `has_any_column_privilege`
for `INSERT`/`UPDATE` on `public` and relevant Storage tables. This
includes **column-only grants**, which table-level checks can overlook.
It also reports:

- `writable_public_sequences`: whether API roles can advance/change
  sequences with `USAGE`/`UPDATE`.
- `create_capable_schemas`: whether API roles can create objects inside
  `public` or `storage`.
- `api_database_create`: whether API roles can create objects at the
  database level.

All three must equal zero before the readiness boolean can be true.
No SQL was executed, no grants were changed, and **the new counters have
not been measured against staging**. The old observed baseline above
remains the last confirmed result, not a validation of this revision.
The query is still diagnostic only: Auth, privileged operations, external
side effects and direct browser APIs need separate controls.

### Global default privileges and implicit function EXECUTE (source-only, 2026-11-13)

The earlier `future_public_write_grants` counter checks the *per-schema*
`public` default ACL, but cannot detect **global** defaults. In PostgreSQL,
a global default applies across schemas; and when no global ACL record
exists for newly created functions, the built-in default is EXECUTE for
`PUBLIC`, inherited by both `anon` and `authenticated`.

The revised diagnostic adds `future_global_write_grants` for the two
previously observed object creators (`postgres` and `supabase_admin`).
It examines future tables, functions and sequences using raw global ACLs
when present and `acldefault()` when absent. It explicitly maps the
sequence catalog kind `S` to the built-in kind `s`. The readiness gate
requires **both** `future_public_write_grants=0` and
`future_global_write_grants=0`; it also includes the PostgreSQL 17+
`MAINTAIN` table privilege in future grant detection.

This is intentionally conservative. A resulting nonzero global function
counter is a **blocker for this strict staging review policy**, not evidence
of an exploited vulnerability. A separately reviewed staging-only global
default ACL change might be required, and it must be evaluated for side
effects on internal or future functions. **No permissions were changed
and no new staging SQL was executed.** The global counter has no verified
live value yet.


The boolean is a conservative **necessary** acceptance check, not proof
of comprehensive read-only security. It does **not** cover auth triggers,
all Storage edge paths, privileged service-role operations, external API
calls, side-effectful GET handlers, or accidental deployment to the
wrong Worker. Those require separate review and authorization.

## Reverified staging readiness (2026-11-13 PT, SELECT only)

Connected Supabase project identity was confirmed as
`nhs-os-staging-preview` (`qihwmfwlhsetxwggaesd`, PostgreSQL 17).
The expanded readiness query was executed using **SELECT-only** SQL against
that staging project and returned:

| Check | Current result |
| --- | ---: |
| Public application tables | 32 |
| Missing RLS / required app SELECT | 0 / 0 |
| Writable application tables | 32 |
| Executable public routines | 6 |
| Writable Storage relations | 3 |
| Writable public sequences | 0 |
| API-role schema CREATE / database CREATE | 0 / 0 |
| Future `public` schema-default write grants | 40 |
| Future global default write grants | 2 |
| `staging_read_only_ready` | **false** |

The schema-default count is now 40 rather than 36 because the revised
PostgreSQL 17 checker includes the `MAINTAIN` privilege. The two global
default findings are consistent with inherited `PUBLIC EXECUTE` on
newly created functions; they are conservative blockers, not proof of an
active exploit.

An additional source-only hardening pass now includes **functions and
procedures**, every ordinary/partitioned Storage table (not just three
named ones), and `TRIGGER` / `MAINTAIN` privileges on existing app and
Storage tables. Re-running the revised SELECT-only query yielded the
same blocker counts listed above. No SQL was executed against the
production project, and **no GRANT/REVOKE, deployment, data write, Auth
change, or staging permission freeze occurred**.

The result remains **NOT READY**. A read-only HTTP guard on the app
cannot guarantee denial of direct Supabase browser requests; a narrowly
scoped, reversible stage-only permission plan still requires separate
owner approval and product compatibility review. No hosted mutation
tests have been performed.

## Staging ACL snapshot / rollback readiness (source-only)

The file `scripts/sql/issue71-staging-acl-snapshot.sql` captures raw ACLs,
object names/signatures, object owners, schema ACLs, default ACLs, API-role
memberships, explicit column-level ACLs, and RLS policies using seven catalog SELECT statements only.
It does not generate or execute any DDL, and does not freeze the database.

Before any **separately approved** staging-only permission mutation:

- Confirm the target project **ID** in the connected Supabase project picker.
  Never infer it from `current_database()` (often just `postgres`).
- Verify all seven snapshot queries ran, including explicit column-level ACLs.
  The column ACL result currently has zero rows; halt on drift.
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

## Side-effectful GET auth callback (review-only protection)

`GET /auth/callback` can invoke `exchangeCodeForSession` or `verifyOtp`;
it is **not** a general read-only GET. PR #72 now explicitly returns 405
for `GET` and `HEAD` on this path in the exact review-mode environment.
Both the Proxy and the callback Route Handler check the review gate before
a token exchange; other hosts with the flag disabled retain the original
production callback behavior. The regression checks verify both layers.

Consequence: emailed recovery, invite and magic-link callbacks are
**unavailable** on the protected read-only review preview. Existing
username/password login uses `POST /auth/review-sign-in`. Hosted sign-in
and sign-out still require separately authorized acceptance; do not claim
recovery or Client A/B test coverage from these source checks. This does
not alter direct Supabase Auth endpoints, which remain outside Next Proxy
and require independent review.

## Independent security-advisor observation

The staging Supabase security advisor currently reports
**Leaked Password Protection Disabled** (warning, not automatically remediated).
It is separate from the read-only grant-level blocker. Do not enable or change
Auth settings as part of this draft without separate approval.

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
- At PR head `094d244`, all twelve workflow outcomes were completed:
  ten successful and two intentionally skipped. **Any subsequent commits
  require new CI** before accepting the source changes.
- Cloudflare Access remains account-member protected; Muse AI and Guide OFF.
- Live 320/390px staging visual acceptance is pending. Client A/B hosted
  account checks are **owner-deferred, not PASSED**.

### Reference
- [Supabase Data API grants + RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase RLS reference](https://supabase.com/docs/guides/database/postgres/row-level-security)

**Decision:** inspect and review only. No staging database change in this PR.
