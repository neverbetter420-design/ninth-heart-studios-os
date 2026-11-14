# NHS OS | Issue #71 | Staging permission-origin review

**Status: DRAFT / SOURCE-ONLY / NOT APPLIED.** This is a permission
inventory and impact review, not authorization to freeze staging.
No GRANT/REVOKE commands, shared migrations or executable rollback DDL
belong in this review.

## Exact environment and provenance

- Staging: `nhs-os-staging-preview`, Supabase project
  `qihwmfwlhsetxwggaesd`, PostgreSQL 17.
- Production: `ninth-heart-studios-os`, project
  `rquscwgdrqkzwjukiqtk`, **never targeted**.
- Source-only catalog inventory recorded on **2026-11-14** with SELECT
  queries against the staging ID. No user/client row data was queried.
- Re-run the project-ID check and the inventory immediately before any
  *separately authorized* change. Do not rely on SQL `current_database()`
  as evidence of Supabase project identity.
- Reproducible catalog audit:
  `scripts/sql/issue71-staging-permission-origins.sql`.
- Preserve complete original ACLs and a nine-section drift checkpoint
  using the already prepared snapshot and fingerprint queries. Raw ACLs,
  grantors and true NULL ACL values are necessary for rollback.

## Verified permission origins

| Layer | Staging catalog findings | Grant source | Freeze review impact |
| --- | --- | --- | --- |
| `public` app tables | 32/32 writable by `authenticated` | `postgres` | Admin/client actions that write may fail |
| `public` app tables | 19/32 directly granted write privileges to `anon` | `postgres` | RLS still governs row operations; remove only in an approved review |
| `public` functions | 6/8 directly callable by `authenticated`, none by `anon` | `postgres` | Six planned/scanner actions could still write via RPC |
| `public` trigger helpers | `handle_new_user()` and `set_updated_at()` have no direct API-role EXECUTE | `postgres` | Avoid changing internal trigger execution accidentally |
| Storage relations | Three relations grant INSERT/UPDATE/DELETE to **both** API roles | `supabase_storage_admin` | Storage product compatibility is a hard stop |
| Storage RLS | Six policies on `storage.objects` include admin management and client upload/delete/read | policy definitions | Row-specific restrictions are not a complete review-mode write freeze |
| Future `public` objects | 40 schema-specific write-capability ACL entries across `postgres` and `supabase_admin` | creator-specific defaults | New tables/functions/sequences could reopen writes |
| Future `storage` objects | Schema-specific defaults for `postgres` also grant API-role capabilities | creator-specific defaults | Do not alter without Storage service-owner review |
| Global defaults | 2 future global `PUBLIC EXECUTE` findings in the strict readiness audit | PostgreSQL built-in function ACL | A global change can affect unrelated schemas/services |

**Interpretation:** A relation privilege is not proof of a successful
unauthorized row write. RLS protects rows, while granted access still
matters to direct Supabase Data API calls. The Next.js HTTP guard cannot
block those direct calls.

The six callable public functions identified by catalog audit are:

- `apply_muse_project_plan(target_plan_id uuid)`
- `cancel_deep_scan_job(p_id uuid)`
- `claim_deep_scan_batch(p_id uuid)`
- `finish_deep_scan_batch(p_id uuid, p_lease uuid, p_processed integer, p_created integer, p_refreshed integer, p_held integer, p_conflicts integer)`
- `pause_deep_scan_batch(p_id uuid, p_lease uuid, p_error text)`
- `renew_deep_scan_batch(p_id uuid, p_lease uuid)`

All six were owned by `postgres`, were not `SECURITY DEFINER`,
and explicitly granted `EXECUTE` to `authenticated` at inspection.
Do not apply blanket EXECUTE revocation across all functions, which
could disrupt internal trigger helpers.

## Proposed staged freeze scope, for separate authorization

1. **Public application table surface.** Review removal of all effective
   write-capable access for `anon` and `authenticated`, including
   inherited/PUBLIC and column-specific grants. Preserve intended
   `SELECT`, RLS and service/internal access. The observed grantor for
   current application table writes is `postgres`; ownership and
   grantor context must be reverified for each object before changes.
2. **Public callable functions.** Review narrowly removing API-role
   `EXECUTE` from the six exact signatures above. Do **not** revoke
   their owner/service/internal grants or accidentally disable triggered
   routines. Confirm actual call paths, not simply names.
3. **Storage.** Treat as a **separate high-risk workstream**.
   Storage grants are issued by `supabase_storage_admin`, not by
   `postgres`. Blanket `REVOKE` on Storage relations or policies
   could disrupt uploads/downloads or internal service operations.
   Review a product-supported, reversible read-only enforcement path
   before any Storage ACL or policy change.
4. **Future object grants.** Review defaults for each creator and schema.
   A `public` schema default cannot cancel a global default
   `PUBLIC EXECUTE` on functions. Do not rewrite global defaults
   without confirming the impact on new functions outside `public`.
   Future Storage defaults require the same separate compatibility gate.
5. **Auth, session and privileged paths.** Confirm the stage-only
   password login/session refresh still works with the proposed policy.
   Direct Auth, Storage, RPC and service-role APIs bypass the Next.js
   Proxy. Outbound scans, automation manual run, email/send and paid
   actions remain prohibited during this review.

## Rollback design, not executed

An actual rollback must be built from a fresh, **private** seven-query
raw ACL snapshot plus its nine-section fingerprint, not from this
summary. Create an owner-reviewed exact inverse privilege delta for
each existing table, column, routine, schema and default ACL. Preserve
the original grantor/owner, role membership, explicit NULL-vs-empty ACL
and RLS policy semantics. In the review, pair each planned change with
its captured before-state, after-state expectations and inverse
instruction. Do not claim an exact restore by using `GRANT ALL`.

Mandatory separate owner approval must specify target project ID,
approved grant/policy surface, access continuity requirements,
authorized stage-only test fixtures, change window, rollback operator
and abort conditions. Before any write-capable test or release, execute
only preapproved actions in the isolated staging project, verify
`staging_read_only_ready`, and test Auth/Storage/RPC compatibility under
a separately authorized synthetic scenario.

## Current decision

**NO-GO for interactive read-only staging.** The last staged
diagnostic found 32 writable public tables, six executable routines,
three writable Storage relations, 40 public future ACL grants and two
global default findings. Source-only CI may pass, but that does not
change the hosted environment or authorize any ACL write.

No deploy, no merges, no new accounts, no scans, no outreach, no Muse
activation, no paid services, no change to production.
