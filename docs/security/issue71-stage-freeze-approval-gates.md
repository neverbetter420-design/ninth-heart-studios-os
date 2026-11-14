# NHS OS | Issue #71 | Staging ACL freeze approval and rollback gates

**Status: DRAFT / SOURCE-ONLY / NOT APPLIED.** This runbook prepares a separate
authorization decision. It does **not** authorize revoking privileges, changing
database settings, deploying Workers, or running hosted write tests.

## Scope and fixed boundaries

- **Staging only:** project `nhs-os-staging-preview`,
  `qihwmfwlhsetxwggaesd` (PostgreSQL 17).
- **Never target production:** project `ninth-heart-studios-os`,
  `rquscwgdrqkzwjukiqtk`. The SQL-visible database name (often `postgres`)
  is **not** sufficient proof of the intended project.
- Related source-only, unmerged drafts: PR #68 (Admin), PR #70 (rooms),
  PR #72 (HTTP barrier), PR #73 (permission readiness). This checkpoint
  branch is stacked above PR #73.
- Do not change production, run scans or outreach, enable Muse AI or Project
  Guide, introduce paid resources, create users, mutate data, merge or deploy.
  Hosted Client A/B accounts and visual acceptance remain deferred.
- Supabase Auth, Storage, service-role work, and outbound network calls need
  their own compatibility assessment. A Next.js Proxy cannot deny calls made
  directly to Supabase's Data API.

## Observational staging checkpoint (2026-11-14; SELECT-only)

`scripts/sql/issue71-staging-acl-drift-checkpoint.sql` was executed against
the verified **staging project ID**. It returns exactly **nine** stable
inventory sections, each with an object count and a fingerprint:

| Section | Observed object count |
| --- | ---: |
| `relation_acl` | 40 |
| `column_acl` | 437 |
| `routine_acl` | 28 |
| `schema_acl` | 2 |
| `database_acl` | 1 |
| `default_acl` | 9 |
| `global_default_effective` | 6 |
| `role_membership` | 24 |
| `rls_policy` | 63 |

The query fingerprints catalog metadata, **not client records**. It preserves
NULL-vs-empty ACL distinctions, records column ACLs (including NULL entries),
role membership, functions/procedures, the database ACL, RLS policies, and
global default function EXECUTE inherited by PUBLIC. The MD5 output is
intended to detect *accidental* drift; it is **not** an adversarial integrity
guarantee, a substitute for the seven full snapshot result sets, or a way
to reconstruct privileges. Fingerprints can change after unrelated
database updates and are not expected to match during an active freeze.

The most recent validated read-only readiness query still found 32 writable
public tables, six callable public routines, three writable Storage tables,
40 future public schema-default write-grant entries, and two future global
default-write entries. `staging_read_only_ready=false`. A successful
snapshot does NOT close the readiness gate.

## Approval gate 1 | Complete an exact baseline and review offline

Before any staging privilege change, an authorized operator must:

1. Verify the connector/dashboard-selected project **ID and name** again.
   Stop if either differs; do not infer environment from `current_database()`.
2. Rerun the nine-section checkpoint AND all seven separate SELECT-only
   statements in `scripts/sql/issue71-staging-acl-snapshot.sql`.
   Save the *complete* exact ACL and policy outputs privately with UTC time,
   source commit and a project-ID-scoped audit record. Preserve true NULLs.
3. Compare all nine section counts/fingerprints with the last approved baseline
   to flag drift; explain each change with an inventory-level diff. Stop if
   object names, object owners, grantors, memberships, or roles are unexpected.
4. Inventory every **effective** caller privilege for `anon` and
   `authenticated`, including inherited/PUBLIC grants and per-column
   access. Inventory the six routine signatures and all new/replaced
   public/Storage relations. Do not assume every executable routine mutates.
5. Audit the impact on password login, SSR session refresh, Auth triggers,
   Storage reads/uploads, direct Supabase browser APIs, service-role
   operations, and default ACL effects on future functions. Review
   `SECURITY DEFINER` functions and all other exposed schemas.
6. Draft an **exact, stage-only** proposed permission delta and a separate
   inverse rollback plan for **each object/grant source**. The rollback must
   be reviewed for correct grantor/owner context and inherited grants.
   An exact NULL ACL is not equivalent to an empty ACL, so do not substitute
   a blanket grant reset or generic `GRANT ALL`.
7. Obtain separate explicit owner approval for the stage-only freeze,
   including a scoped change window, rollback operator and conditions.
   **This document and a passing CI job are not that approval.**

## Approval gate 2 | Controlled staging-only implementation (not authorized)

Only after gate 1 and separate approval, a qualified operator could execute
a reviewed, reversible, staging-project-ID-scoped change window. Operations
must be staged in independently reviewable groups:

- Preserve application SELECT access and existing RLS while considering
  removal of unnecessary public app table write privileges for API roles.
  Inspect column-only privileges and inherited/PUBLIC grants, not only
  table-level grants.
- Separately assess whether public RPC EXECUTE can be restricted without
  breaking triggers, Auth, background workflows or internal grants.
- Treat Supabase Storage as its own product. Do **not** blanket-revoke
  `storage` relations or the `service_role` without compatibility
  review. The separate auth/data/storage endpoints bypass Next Proxy.
- Assess `postgres` and `supabase_admin` future default grants.
  PostgreSQL global default `PUBLIC EXECUTE` cannot be negated by a
  per-schema REVOKE. A global default change can affect future functions
  in other schemas; owner and infrastructure compatibility review is
  mandatory before including any such change.
- Never put staging-only ACL DDL into shared `supabase/migrations` or CI.
  There is deliberately **no executable freeze or rollback DDL in this PR**.

## Approval gate 3 | Verify, roll back or stop (not authorized)

- Read-only acceptance: re-run the privilege diagnostic and confirm all
  required writable counters are zero, existing RLS is present and
  intended application SELECT permissions survive. Confirm exact project
  ID, inactive Muse/scans/outreach, and Cloudflare Access boundary.
- Hosted login/logout, cross-origin malicious POSTs, direct Data API writes,
  Storage uploads, external effects and real client isolation require
  **separate explicit test authorization** and safe fixtures.
- For rollback, restore **only the captured exact authorized privilege
  changes** using the preapproved inverse plan. Check grantor context,
  default privileges, routines, Storage compatibility and inherited grants.
  Re-run the seven complete snapshots and the nine-section checkpoint
  after rollback; compare to the immediately pre-freeze baseline.
  Investigate every mismatch; do not claim restoration merely because a
  rollback script finished.
- **Abort and escalate** if the project ID, baseline, ACL owner/grantor,
  available rollback plan or critical app/Auth/Storage behavior differs
  from the approved evidence. Never switch over to production to "fix"
  a staging issue.

## Release decision

**NO-GO.** No staging ACL freeze has been applied, and a read-only review
sandbox is not established. Green source-only tests do not authorize a
Worker deployment, hosted mutation probe, production release or merging
the design drafts. The next write-capable step requires an explicit,
separate owner-approved staging change request.

References:
- `scripts/sql/issue71-staging-acl-drift-checkpoint.sql`
- `scripts/sql/issue71-staging-acl-snapshot.sql`
- `scripts/sql/issue71-staging-readonly-acceptance.sql`
- `docs/security/issue71-staging-database-write-freeze.md`
- PostgreSQL 17: https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html
- Supabase API grants: https://supabase.com/docs/guides/api/securing-your-api
