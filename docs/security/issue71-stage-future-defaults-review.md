# Issue #71 | Staging future-default grants compatibility decision

**Status: NO-GO for default ACL mutation.** Source-only review as of
2026-11-14. No owner approval has been given to change future ACLs.
The authorized public table/function freeze did not alter default ACLs.

## Scope

- Staging `nhs-os-staging-preview`: `qihwmfwlhsetxwggaesd`.
- **Never target production:** `rquscwgdrqkzwjukiqtk`.
- Current PostgreSQL 17 catalog evidence: two object creators,
  `postgres` and `supabase_admin`, each have `public` schema-level
  defaults that grant `anon` and `authenticated` future rights on
  new relations, sequences, and functions.
- Current strict readiness result:
  `future_public_write_grants=40`, and
  `future_global_write_grants=2`.
- `postgres` also has equivalent future default privileges in
  `storage`, including 20 write-capability entries across the two
  API roles. Those are separately managed and **not in scope** for
  a `public`-only change.

## What the 40 public-schema entries mean

For each of two creators and two API roles, the current schema-local
default ACL includes seven relation privileges
(`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`,
`TRIGGER`, `MAINTAIN`), two sequence mutation rights
(`USAGE`, `UPDATE`), and function `EXECUTE`.
The table-privilege count was expanded for PostgreSQL 17
`MAINTAIN`; it is not evidence of 40 tables.

A separately approved, targeted, reversible change to future
**`public`** objects could remove *per-schema grants* for only
`anon` and `authenticated`, by creator and object class, without
removing `service_role`, owner or `SELECT` defaults. It would
**not** remove any present grants from existing objects, and no
migration should silently recreate them during the review window.

The original raw default ACLs must be preserved, including exact
grantors, creator roles, schema scopes and NULL vs empty ACL; compare
a fresh baseline before changes. Do not use blanket GRANT ALL
or rewrite the role's default privileges without an exact inverse.

## Why the final two are more dangerous

PostgreSQL grants new functions/procedures `EXECUTE` to `PUBLIC`
by default when no role-specific global ACL overrides that behavior.
A `REVOKE` limited to `IN SCHEMA public` **cannot remove**
the global implicit `PUBLIC EXECUTE` default.
To eliminate this automatic permission one would need to review
changing the **global defaults for each creator**, which also changes
access for functions created in Auth, Storage, extensions, and other
schemas. There is no safe, supported assumption that such a global
change is harmless to Supabase-managed infrastructure.

**Recommendation:** keep `future_global_write_grants=2` an
explicit NO-GO for the strict boolean until a qualified Supabase
compatibility review and separate scope approval. Operationally
disabling deploys/migrations while testing reduces exposure but
**does not convert** the strict readiness query to PASS.
Do not edit a readiness check merely to hide this risk.

## Design options (none authorized)

1. **Narrow public future-default review:** evaluate a separately
   approved, exact reversible `public` schema-only default
   privilege update for both creators. Preserve owner/service
   grants and expected SELECT. Revalidate the 40-counter and
   direct API grant semantics after any change.
2. **Global default review:** require an explicit Supabase
   infrastructure compatibility check (Auth, Storage, extension
   creation, service-function invocation) before considering any
   global default function EXECUTE change. Treat the entire staging
   project's future functions as potentially affected.
3. **Read-only visual acceptance without database mutation:**
   rely on an isolated synthetic/snapshotted preview environment,
   strong request barriers and explicit operational constraints.
   Do not claim the existing stage has a universal read-only
   guarantee merely because the UI doesn't expose write buttons.

No option is currently executed. A passing source-only CI result
does not authorize hosted storage/object writes, schema changes,
permission changes, deployment or production work.

References:
- https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html
- https://supabase.com/docs/guides/api/securing-your-api
- `scripts/sql/issue71-staging-readonly-acceptance.sql`
- `docs/security/issue71-stage-storage-policy-review.md`
