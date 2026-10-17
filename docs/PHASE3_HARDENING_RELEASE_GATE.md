# Phase 3 security hardening: release gate (NOT APPLIED)

## Scope

This is a draft SQL migration committed only to the NHS OS feature branch:

`supabase/migrations/20261017030000_phase3_client_decision_sender_guard.sql`

It must not be executed against the active `ninth-heart-studios-os` project until a later **separate explicit authorization**. No schema, policy, customer data, membership, or approval decision change is part of preparing this proposal. The existing Client A pending approval is **not** a disposable decision fixture; do not approve/decline it merely to exercise the policy.

**Repository test command:** `npm run verify:phase3-security`. These source-level contract checks do not connect to Supabase or mutate data. They prove certain migration protections exist in source, **not** that Postgres enforces them in a deployed environment.

## Safeguards proposed in the migration

1. A `security invoker`, private-schema BEFORE UPDATE trigger checks non-admin approval decisions. It denies edits to all immutable fields, including future schema fields, and requires an original `pending` status and new `approved` or `declined` status.
2. Approval `decided_by` must match `auth.uid()`; `decided_at` is replaced server-side with `statement_timestamp()`; comment length is limited to 280 characters. The existing `set_approvals_updated_at` trigger runs earlier in alphabetical order and remains authoritative for `updated_at`.
3. The approval RLS UPDATE policy continues to check both old and new rows for membership in the same project and additionally validates `decided_by` and `decided_at`.
4. The client INSERT policy for messages adds `sender_id = auth.uid()` to the existing own-project predicate; the separate administrator policy is not changed.
5. Trusted `postgres` / `service_role` and authenticated NHS administrator operations remain supported. This trust boundary must be tested in staging before applying the migration.

## Staging security test matrix

Use a **separate Supabase test project or local ephemeral database** with the migrations applied in chronological order and disposable Admin, Client A and Client B accounts. Never seed or alter the existing customer records in active Supabase. Test both allowed and rejected mutations and verify exact persisted results:

| Actor | Operation | Expected |
|---|---|---|
| Client A | Read their own pending disposable approval | Allowed |
| Client B | Read/update Client A's approval | Denied or zero rows |
| Client A | `pending -> approved` with their own `decided_by` | Allowed; timestamp overwritten by DB |
| Client A | `pending -> declined` with their own `decided_by` | Allowed; timestamp overwritten by DB |
| Client A | Modify approval title, project, requestor, created/requested timestamps, ID, or future metadata during decision | Denied; row unchanged |
| Client A | Spoof another `decided_by` or an arbitrary decision timestamp | Spoofed identity denied; timestamp is server-generated |
| Client A | Re-decide a completed approval | Denied; row unchanged |
| Client A | Client comment longer than 280 characters | Denied; row unchanged |
| Client A | Send message with their own `sender_id` to their own project | Allowed |
| Client A | Send message claiming Client B's `sender_id` | Denied |
| Client A | Send message to Client B's project | Denied |
| Client B | Read Client A's messages | Denied or zero rows |
| NHS admin | Create/modify approval and send legitimate administrative messages | Allowed |
| Anonymous user | Read or mutate protected approval/message data | Denied |

Tests must preserve old/new row states and verify RLS/grants/trigger names after migration. Ensure table-level `UPDATE` grants to `authenticated` cannot bypass the trigger. A user should also verify normal client approval and message UI still behave correctly after the migration.

## Rollback and clean exit

Before staging deployment, capture the previous trigger/function existence and complete RLS policy definitions. A rollback would restore precisely the prior message and approval policies and remove the new trigger/function, but **restoring the insecure approval/message policy is not an acceptable long-term production fallback**. Prefer fixing the migration in staging before applying it. No automatic migration or rollback should occur in production.


## PostgreSQL 17 isolated enforcement evidence (2026-10-17)

The draft migration was applied successfully to an **ephemeral PostgreSQL 17.11 container** during GitHub Actions [run #39041643690](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39041643690). This did not connect to active Supabase and did not require any real credentials.

The workflow runs `supabase/tests/phase3_isolated_fixture.sql` (synthetic Admin, Client A, Client B, projects, old RLS/grants and update trigger), then applies the **exact staged migration**, then runs `supabase/tests/phase3_security_enforcement.test.sql` with actual Postgres role switches and RLS:

- Own approvals and messages allowed; other client's project, approvals and messages denied.
- Attempts to change approval title, project, timestamps, future metadata field, decided-by identity and completed status rejected.
- Approved/declined client decisions allowed; database timestamp replaces user-supplied timestamp.
- Cross-project messages and sender spoofing rejected.
- Admin and trusted service-role maintenance allowed; anonymous reads/writes denied.
- Test transactions rolled back; synthetic fixtures returned to their starting state.

**Boundary:** This is a real PostgreSQL enforcement test of the exact migration, but its synthetic schema and `auth.uid()`/`private.*` helpers are purpose-built approximations. The separate full local-Supabase integration run below covers real Auth, PostgREST and the full repository migration chain. A separately hosted Supabase project and UI end-to-end tests are still distinct release considerations.

## Full local Supabase Auth and PostgREST integration evidence (2026-10-17)

[GitHub Actions run #39042764810](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39042764810) **passed**, using an ephemeral local Supabase stack, full chronological repository migrations, real GoTrue-created synthetic users, JWT-backed PostgREST requests, and the exact proposed hardening migration. No hosted Supabase project credentials or customer records were supplied.

`scripts/verify-phase3-supabase-local.mjs` passed **9 authenticated/API scenarios**, including cross-client approval reads and updates, immutable-field edit denial, forged `decided_by` denial, oversize comment denial, valid approve and decline, server-generated decision timestamps, denial of re-decisions, sender spoofing and cross-project message denial, administrator writes, and anonymous isolation. Synthetic data was in disposable containers.

The full-schema replay identified and led to a source-only fix of two missing PL/pgSQL terminators in the **historical** migration `20261013232917_secure_client_document_updates.sql`. This repairs reproducible fresh-install SQL syntax but does not execute the file again on your active Supabase project.

**Provisioning observation:** GoTrue may persist `app_metadata` after the `auth.users` INSERT trigger fires, so a newly created synthetic account with `app_metadata.role=admin` received the safe `client` profile role initially. The CI fixture explicitly promoted only its disposable admin through the service-role `profiles` update. Existing trusted `scripts/seed-test-users.mjs` already upserts `profiles.role` separately. Do not assume new admin accounts become admins solely from `app_metadata` passed to `createUser`. This issue is fail-closed, not a demonstrated admin bypass.

**Coverage boundary:** Local Supabase runs actual Auth/REST/DB services, but this is not a separate **hosted** Supabase staging project. No browser-level client approval/message submissions against this local stack were included. Before any live migration, decide whether a hosted staging project plus browser QA is needed and obtain explicit approval for production schema changes.

## Local NHS OS client portal UI evidence (2026-10-17)

[Isolated local Supabase + browser QA #39043527259](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39043527259) **passed**: 9/9 Auth/PostgREST permission scenarios and 2/2 Playwright desktop/mobile client-portal interaction scenarios.

The same ephemeral GitHub Actions Supabase stack applied the full migration sequence and provided only synthetic Auth users and records to a locally running NHS OS Next.js app. The browser tests:
- Signed in Client A, approved one pending record and requested changes on a second using the real portal buttons;
- Verified decisions, identity, comment, and server timestamp persisted via local Supabase;
- Sent a real client message from the portal and verified persisted sender identity;
- Reloaded the portal and found saved messages and decisions in the UI;
- Signed in Client B and confirmed cross-client project links, approval labels, and messages were hidden;
- Repeated the scenario on desktop Chromium and mobile Chromium.

These tests use an explicit CI-only guard that refuses any remote Supabase URL, project token or non-local API target. All test records were synthetic and containers were disposed after the run. **No customer data or active Supabase migration changed.** A separate hosted staging environment is still unavailable, but the full local application/browser integration gate has been satisfied.

## Release blocking status

- [x] Existing Phase 2 write QA: 10/10 and zero active QA leftovers on run #39021575467.
- [x] Existing Phase 3 read-only access checks: 18/18 on run #39022920152.
- [x] Proposed migration and offline contract checks committed on draft branch.
- [x] CI for the new migration-source verification and build is green.
- [x] Isolated PostgreSQL 17 database applies the exact migration and passes synthetic negative mutation tests in CI.
- [x] Disposable local Supabase verified chronological migrations, Auth, PostgREST and API approval/message security (9/9).
- [x] End-to-end approval/message UI passed in disposable local Supabase with desktop/mobile Playwright (2/2).
- [ ] Optional separate hosted Supabase staging project (not currently available) if required before migration application.
- [ ] Explicit approval to apply migration to the active project.
- [ ] Separate verification after production policy deployment.
- [ ] Merge/deploy authorization for draft PR #14 (not included in this phase).

Never run `scripts/verify-security.mjs` against live Supabase during a read-only phase; that older script performs an UPDATE probe.
