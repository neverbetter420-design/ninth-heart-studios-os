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

## Isolated staging tests required (none executed yet)

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

## Release blocking status

- [x] Existing Phase 2 write QA: 10/10 and zero active QA leftovers on run #39021575467.
- [x] Existing Phase 3 read-only access checks: 18/18 on run #39022920152.
- [x] Proposed migration and offline contract checks committed on draft branch.
- [ ] CI for the new migration-source verification and build is green.
- [ ] Isolated PostgreSQL database applies the migration and runs the negative mutation test matrix.
- [ ] Explicit approval to apply migration to the active project.
- [ ] Separate verification after production policy deployment.
- [ ] Merge/deploy authorization for draft PR #14 (not included in this phase).

Never run `scripts/verify-security.mjs` against live Supabase during a read-only phase; that older script performs an UPDATE probe.
