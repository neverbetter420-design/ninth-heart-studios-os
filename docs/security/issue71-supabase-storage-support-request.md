# NHS OS | Supabase Support ticket draft | Storage RLS policy ownership

**Status: DRAFT / NOT SUBMITTED.** Prepared for a project administrator.
This is a question about a supported execution path, **not a request to
change the user's account, escalate privileges or execute SQL without
additional authorization**. This ticket contains metadata only. Do not
attach API keys, database passwords, tokens, user information, or private
ACL export files.

**Subject:** Hosted staging `storage.objects`: supported owner-capable way to create/rollback 3 RESTRICTIVE RLS policies

## Message to Supabase Support

Hello Supabase Support,

We are preparing a temporary, reversible **read-only review** for our
isolated hosted staging project. We need to block file uploads,
overwrites, and deletes through the regular `anon` and
`authenticated` roles while retaining all existing file-reading
policies and platform-managed Storage access.

**Project reference:** `qihwmfwlhsetxwggaesd`
**Project name:** `nhs-os-staging-preview`
**Postgres version:** `17.11.0.011`
**Environment:** isolated staging only. Our production project is not
in scope and must not be targeted.

We have **not attempted `CREATE POLICY` or `DROP POLICY`** on
`storage.objects`; no SQLSTATE 42501 error has been observed. We
checked catalog and role metadata with SELECT-only queries instead:

- SQL connector: `current_user=postgres`, `rolsuper=false`.
- Table `storage.objects` owner:
  `supabase_storage_admin`.
- `postgres` is not a member of that owner role, cannot inherit its
  privileges, and cannot `SET ROLE` to it (per role-membership checks).
- The table has RLS enabled, with six existing policies.
  The original six-policy metadata digest was
  `73b4be5cc357949344792320ffff5dc1`.
- `anon` and `authenticated` have `BYPASSRLS=false`;
  `service_role` is `BYPASSRLS=true`.
- A draft change exists but **has not been applied**.

The exact proposed, stage-only policy definitions are:

```sql
CREATE POLICY "nhs_review_deny_storage_insert"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "nhs_review_deny_storage_update"
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "nhs_review_deny_storage_delete"
  ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);
```

We deliberately do **not** want to change or disable the six original
`PERMISSIVE` policies, bypass RLS, alter `storage.objects` ownership,
grant managed owner membership, modify Storage table privileges, or
expose a service-role key. This review must leave `SELECT` intact.
An additional, independently validated rollback would drop only the
three named policies after verifying their definitions.

**Questions:**

1. For this particular hosted project, what **documented, supported,
   reversible and owner-capable workflow** may create and later drop
   exactly these three `AS RESTRICTIVE` policies? Does it require
   the Dashboard SQL Editor, Dashboard Storage policy editor, an
   officially supported Management API route, or Supabase operator
   assistance?
2. Can the current Storage policy editor create or preserve an
   `AS RESTRICTIVE` policy with both API roles and separate operations?
   If it only creates `AS PERMISSIVE`, please confirm the supported
   alternative. A `PERMISSIVE WITH CHECK(false)` policy would not
   override an existing permissive allow policy.
3. Is there an expected, authorized privilege mapping between
   SQL Editor `postgres` and the managed `supabase_storage_admin`
   table owner for Storage policy DDL in this project? Please avoid
   requiring `ALTER OWNER`, internal role grants or an unreviewed
   privilege escalation.
4. What rollback approach preserves the original six Storage policies
   verbatim and avoids accidentally affecting platform migrations,
   `service_role`, authenticated file reads or the Storage API?
5. Are there special caveats for Storage uploads via REST, S3
   compatibility, or admin/service operations after the restrictive
   policies are installed? Which no-side-effect checks should precede
   any separately authorized synthetic file tests?

Please **provide instructions only**, not execute changes on our
behalf. We will separately authorize the exact supported implementation
and verify it in the isolated staging project.

Thank you.

## Owner handoff

1. Open [Supabase Support](https://supabase.com/dashboard/support/new)
   while signed in as a project administrator.
2. Select the isolated **staging project** by the exact ref above.
3. Copy the subject and body from this document, without this wrapper.
   Avoid uploading user data, service-role keys, passwords or complete
   private ACL exports.
4. On response, review the supported method against
   `docs/security/issue71-stage-storage-policy-proposal.sql` and
   `docs/security/issue71-stage-storage-policy-rollback.sql`.
5. **Stop if the proposed solution changes ownership, weakens reads,
   uses only permissive false policies, lacks a rollback, or affects
   production.** Clarify with Support before taking any action.

### Related sources

- Official Storage access control:
  https://supabase.com/docs/guides/storage/security/access-control
- Official managed Storage schema constraints:
  https://supabase.com/docs/guides/storage/schema/design
- Official support portal: https://supabase.com/support
- Our PR #76: https://github.com/neverbetter420-design/ninth-heart-studios-os/pull/76

**No ticket has been sent and no Storage policy has been changed.**
