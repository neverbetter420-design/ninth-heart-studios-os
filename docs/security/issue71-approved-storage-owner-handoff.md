# Issue #71 | Approved staging Storage policy handoff (execution blocked)

**Status: approved for three named policies only; NOT APPLIED.**
Approval in conversation on 2026-11-14 covers the staging-only
`storage.objects` write restrictions proposed in PR #76.
Approval does **not** grant an executor table ownership or waive the
requirement to validate a reversible, supported Storage policy workflow.

## Target identity and live preflight

| Field | Last SELECT-only staging result |
| --- | --- |
| Approved project | `nhs-os-staging-preview` |
| Approved project ref | `qihwmfwlhsetxwggaesd` |
| Production: never target | `rquscwgdrqkzwjukiqtk` |
| Connected SQL role | `postgres` |
| Connected role superuser | `false` |
| `storage.objects` owner | `supabase_storage_admin` |
| Can current role assume owner | No |
| `owner_policy_ddl_ready` | `false` |
| Existing Storage-object policies | 6 |
| Approved restrictive policies installed | 0 |
| Original six-policy fingerprint | `73b4be5cc357949344792320ffff5dc1` |
| Staging full read-only readiness | `false` |

The earlier, already applied **public-only** database ACL freeze is
still verified: 32 app tables, 0 API-role writable app tables,
0 callable public API-role RPCs, 0 missing RLS/SELECT. Remaining
diagnostic blockers: 3 raw-grant Storage relations, 40 public future
default write entries, and 2 global default future entries.
A raw Storage grant is not proof of an RLS-permitted write.

## Exact approved scope

Only the three **RESTRICTIVE** policies defined in
`docs/security/issue71-stage-storage-policy-proposal.sql`:

| Name | Command | Logic |
| --- | --- | --- |
| `nhs_review_deny_storage_insert` | INSERT | `WITH CHECK (false)` |
| `nhs_review_deny_storage_update` | UPDATE | `USING (false) WITH CHECK (false)` |
| `nhs_review_deny_storage_delete` | DELETE | `USING (false)` |

Both `anon` and `authenticated` are intended targets. Preserve all
six existing policies exactly, including their two administrative
`ALL` permissions, to avoid silently removing application `SELECT`.
Preserve the Storage table owner, `service_role`, bucket settings and
all platform-managed table grants. Avoid Auth and other schemas.

**Important:** adding `PERMISSIVE` `false` policies does not deny
access already allowed by another permissive policy. Do not substitute
ordinary permissive policies if the supported editor cannot set
`AS RESTRICTIVE`. Do not disable, replace or delete existing
`ALL` policies as a workaround without a **new impact analysis and
separate approval**. These changes are not equivalent.

## Supported operator path and stop conditions

1. A project administrator uses the **Supabase Dashboard Storage →
   Policies** workflow or asks Supabase support about its current
   **supported restrictive-policy management mechanism** for the
   specific hosted PostgreSQL project.
2. The operator must confirm the chosen mechanism can apply **RESTRICTIVE**
   policies with exact operation, role, and predicate semantics, and
   can also reverse them. The current connected SQL role is not
   table-owner-capable. Dashboard availability is **not evidence**
   that restrictive policy creation is supported by that editor.
3. If the editor only offers `PERMISSIVE`, if the owner-capable API
   is undocumented/unavailable, or if the operator cannot independently
   verify how the inverse is executed, **STOP**. No permission escalation,
   `ALTER OWNER`, reserved-role membership, service-role keys in
   browser/CI, or unreviewed SQL/CLI migrations.
4. Before any later supported execution, reconfirm exact **staging
   project ref** and rerun all seven ACL snapshots, nine-section
   fingerprint, and `issue71-staging-storage-policy-readiness.sql`.
   Stop on drift. Keep original raw policy definitions and grantor
   context privately.
5. Execute the **transactionally guarded proposal** only through a
   qualified, authorized owner-capable path, or produce an equivalent
   supported Storage policy operation with verified restrictive
   semantics. Review a matching rollback mechanism first.
6. Verify `pg_policy.polpermissive=false`, commands `a,w,d`,
   both API roles, exact `false` conditions, unchanged original
   six-policy digest, and SELECT policy preservation. Run separate
   service-health and approved synthetic file API acceptance before
   calling the Storage layer write-safe.
7. Keep the global and schema-default ACL counters independently
   gated. Even successful Storage policy creation does **not**
   satisfy the raw-grant-based `staging_read_only_ready` boolean.
   Do not edit that boolean to conceal remaining limitations.

**No deployment, PR merge, Cloudflare Worker change, Auth provisioning,
client A/B tests, hosted upload/delete probes, paid service, Muse
activation, scans or outreach is part of this approval.**

## Source references

- `docs/security/issue71-stage-storage-policy-proposal.sql`
- `docs/security/issue71-stage-storage-policy-rollback.sql`
- `scripts/sql/issue71-staging-storage-policy-readiness.sql`
- `docs/security/issue71-stage-future-defaults-review.md`
- [Supabase: Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase: Storage policy setup](https://supabase.com/docs/guides/storage/quickstart)
- [Supabase: platform-managed permissions](https://supabase.com/docs/guides/platform/permissions)
- [PostgreSQL 17 RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)


## Support escalation prepared, not submitted

Official Supabase Storage RLS documentation permits custom policies but
does not establish an owner-capable `AS RESTRICTIVE` workflow for this
specific project's current SQL connector. Public community discussions
contain conflicting answers about whether hosted `postgres` can create
restrictive policies and whether the Dashboard editor preserves them.
Neither claim overrides the live staging ownership evidence.

An exact, credential-free ticket draft is saved at
`docs/security/issue71-supabase-storage-support-request.md`, including
the approved scope and the matching rollback requirement. The official
submission entry point is
https://supabase.com/dashboard/support/new.

**Do not claim the Support request was submitted.** Do not attempt
`CREATE POLICY` merely to force an ownership error, use reserved-role
membership or `SET ROLE` workarounds, or adopt a permissive
false policy as if it overrode existing permissive grants.

The team can resume this gate when the supported and authorized method
is confirmed in a response. Keep the current stage public-ACL freeze
active and all production/deploy operations untouched in the meantime.
