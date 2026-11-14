# Issue #71 | Staging Storage policy-only read-only review (UNAPPLIED)

**Status:** SOURCE-ONLY PROPOSAL. **NOT APPLIED.** A **separate owner approval**
is required for the three `storage.objects` RLS policies in this review.
The earlier approval for the existing `public` table/RPC freeze does **not**
authorize Storage changes or new hosted write tests.

## Environment and fresh evidence

- Approved public-only freeze was applied to **staging**
  `nhs-os-staging-preview`, Supabase project ID `qihwmfwlhsetxwggaesd`.
- **Never target production** `rquscwgdrqkzwjukiqtk`.
- PostgreSQL 17.11; Supabase Storage is a platform-managed schema.
- 2026-11-14 SELECT-only stage audit: eight ordinary `storage` tables,
  eight with RLS, zero with FORCE RLS. The `storage.objects` table is
  owned by `supabase_storage_admin` and has six original permissive
  policies; the other seven Storage tables currently have zero policies.
- The original six Storage-object policies have a stable metadata
  fingerprint `73b4be5cc357949344792320ffff5dc1`. This fingerprint
  is a drift detector only, **not** a replacement for raw policy and
  ACL snapshots or cryptographic attestation.
- `anon` and `authenticated` have `rolbypassrls=false`;
  `service_role` has `rolbypassrls=true`. The Storage owner
  `supabase_storage_admin` is not BYPASSRLS but is the table owner,
  which bypasses RLS while FORCE RLS remains off.
- `storage.objects`, `storage.buckets` and
  `storage.buckets_analytics` still grant API-role INSERT/UPDATE/DELETE.
  For the other seven Storage tables, no existing permissive
  write RLS policies were observed, so grants alone do not prove
  an allowed row write. Do not mistake a grant count for an exploit.
- Current, SELECT-only
  `scripts/sql/issue71-staging-storage-policy-readiness.sql` returned
  `reserved_policy_names=0`,
  `valid_restrictive_write_policies=0`, and
  `api_role_storage_policy_guard_ready=false`. Nothing was installed.

The six original Storage policies comprise:
- Two authenticated admin `ALL` policies, scoped to `form-sources`
  and `project-files`
- Two authenticated `SELECT` policies for client reading
- One authenticated `INSERT` client upload policy
- One authenticated `DELETE` client delete policy

Each original policy must be preserved verbatim. Do not use a global
`FOR ALL` restrictive policy: it would block `SELECT` and break
the preview's intended file-reading UX.

## Additional hard stop: policy DDL ownership (2026-11-14, SELECT-only)

The connected staging SQL executor is **`postgres`**, a **non-superuser**.
The actual `storage.objects` owner is **`supabase_storage_admin`**.
`postgres` is **not** a member of that owner role, cannot inherit its
owner privileges, and cannot `SET ROLE` to it. This was observed with
`current_user`, `rolsuper`, `pg_has_role` and `pg_class.relowner`
using SELECT-only catalog queries against the staging project ID.

PostgreSQL requires table ownership (or superuser authority) to add,
alter, or remove table RLS policies. **The current connector therefore
cannot execute this proposed CREATE POLICY or its DROP POLICY rollback.**
Treat the present executor as an additional **NO-GO**, even if the owner
separately authorizes the three policy definitions. Do not work around
it by changing table ownership, granting privileged role membership,
running as service-role, resetting database passwords, or altering
platform-managed Storage grants.

The source proposal and inverse now explicitly **abort in their
preflight DO block** when the executor does not equal the Storage
table owner and is not a superuser. The corresponding SELECT-only
readiness report includes `executor_role`,
`owner_policy_ddl_ready`, and `api_role_storage_policy_guard_ready`.
The last staging run returned:

- `executor_role=postgres`
- `storage_objects_owner=supabase_storage_admin`
- `executor_superuser=false`
- `owner_policy_ddl_ready=false`
- `reserved_policy_names=0`
- `api_role_storage_policy_guard_ready=false`

**Required future dependency:** a qualified operator with a supported,
authorized, owner-capable Storage policy workflow must independently
review the complete SQL and exact rollback, under separately scoped
staging approval. That workflow is not available through the current
`postgres` connector. No policy has been installed.

PostgreSQL ownership reference:
https://www.postgresql.org/docs/17/ddl-rowsecurity.html

## Narrow candidate, separate approval required

`docs/security/issue71-stage-storage-policy-proposal.sql` is an
**unapplied, transactionally guarded** proposal to add exactly three
operation-specific restrictive policies, targeting `anon` and
`authenticated` only:

| Restrictive policy name | Operation | RLS predicate |
| --- | --- | --- |
| `nhs_review_deny_storage_insert` | INSERT | `WITH CHECK(false)` |
| `nhs_review_deny_storage_update` | UPDATE | `USING(false) WITH CHECK(false)` |
| `nhs_review_deny_storage_delete` | DELETE | `USING(false)` |

Existing permissive `SELECT` policies are not modified. With RLS
enabled and those API roles without BYPASSRLS, restrictive RLS policies
intersect permissive grants to deny those writes. The service-role
RLS bypass and the Storage owner remain unchanged. The proposal aborts
before mutation if table ownership, RLS posture, role posture, six
original policy definitions, existing public freeze, or table counts
have drifted. Its postcondition checks three precise policy definitions
and preservation of all six originals.

`docs/security/issue71-stage-storage-policy-rollback.sql`
provides the exact inverse: after validating all three restrictive
policies and all six original policies, it drops only those three
names, then verifies that the six original policies match the prior
fingerprint. Both proposal and inverse run in transactions but are
**not automatically run, applied, or added to migrations**.

## Product compatibility and remaining limits

Supabase officially supports custom RLS policies on `storage.objects`,
and recommends **not altering Storage tables/schema directly**. This
approach avoids changes to table grants, `supabase_storage_admin`,
`service_role`, bucket configuration, S3/object metadata or the
platform-managed Storage schema definition.

However, the policy-only approach:
- Does **not** revoke the raw Storage table grants. The existing strict
  `staging_read_only_ready` diagnostic will still return **false**.
- Does **not** stop direct Storage service/admin, owner, BYPASSRLS,
  privileged API, background automation or external side effects.
- Does **not** prove HTTP object uploads fail safely. Stored bytes and
  metadata may be handled by separate services, so authorized
  synthetic-asset API acceptance is required before relying on it.
- Does not touch Storage Analytics/S3/vector permissions and policies
  not in `storage.objects`. Re-run the catalog inventory if the
  Storage schema changes.
- Does not resolve future default grants from `postgres`,
  `supabase_admin` or global `PUBLIC EXECUTE`. Those remain a
  separate review with a larger blast radius.

## Separate approval and verification gates

1. Reconfirm **the connector project ID**; `current_database()` may
   just be `postgres` and is not an environment discriminator.
2. Re-run the exact seven ACL snapshots and nine-section fingerprint,
   plus the Storage policy readiness query. Save outputs privately.
3. Confirm the six original policy definitions/hash, their grantors,
   RLS state, eight tables, role posture and absence of any three
   reserved policy names. Investigate any drift before proceeding.
4. Obtain **separate explicit authorization for these exact three
   Storage policies** after reviewing Supabase Storage/Auth
   compatibility. Do not infer this from approval of public tables.
5. Only after authorization, run the tightly scoped transaction
   against staging, then re-read catalog evidence. Do not publish,
   provision users, or send hosted mutation probes without separate
   authorization for a synthetic test plan.
6. If a policy adversely affects file reads or Storage health, run
   the exact inverse after fresh preflight and confirm the six original
   policies and other seven Storage tables are unchanged.
7. Only reopen visual/hosted review after the **entire** intended
   preview read-only posture has been verified, including direct
   Supabase APIs, service-role use, future grants and external effects.

**Decision:** no execution in this PR. Public application data remains
frozen under the prior stage-only approval, and production is untouched.

References:
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/schema/design
- https://www.postgresql.org/docs/17/sql-createpolicy.html
