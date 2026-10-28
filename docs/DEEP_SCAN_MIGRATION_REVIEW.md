# Deep Scan database migration review

**Review-only, not applied.** Migration: `supabase/migrations/20261028090000_deep_scan_jobs.sql`.

## Why it is needed
The existing scanner runs up to 12 business checks in one request. Longer scans need persisted candidate queues, position counters and an atomic lease so repeated taps or interrupted Cloudflare requests do not process the same segment concurrently. This table is a private, admin-owned queue for **on-demand** work only; it creates no timers, no scheduled jobs, no AI API calls and no new outward messages.

## Existing production baseline
- **Live read-only inventory verified on 2026-10-28:** production records **24 applied migration versions**, including the older client-safety migration `20261017030000` and Lead Search queue migration `20261020063055`. Both stored SQL statements were checked byte-for-byte against the corresponding source files and match exactly.
- The older guard in `scripts/verify-release-preflight.mjs` still expects just 22 baseline versions plus one formerly proposed security migration (23 source files). Its assumptions are **stale**; they must not be treated as the production truth.
- The Lead Search queue SQL was missing from the current scanner stack because the original PR #20 remains unmerged although the migration is already applied. The exact 4,201-character SQL has now been **restored in PR #46 source only**. Do not separately merge PR #20 without reviewing its additional code.
- **Current source includes 25 SQL files: 24 previously applied migration sources + 1 proposed Deep Scan migration (`20261028090000`).** The release-preflight guard is deliberately still red. Do not bump its expected count, suppress this check, or apply SQL until the owner reviews and approves the **exact 24-version source inventory and the new proposed migration**.
- Production currently has **no `public.deep_scan_jobs` table** and no applied migration version `20261028090000`. No live schema mutation occurred in this review.
- Apply only via the reviewed production migration process, after auth/permission checks; do not apply as a side effect of preview.
- `public.deep_scan_jobs` does **not** currently exist in production, and the UI intentionally disables creation until the table is available.

## Security properties to review
1. `created_by` references `auth.users`; owner-scoped admin RLS using `private.is_admin()` and `auth.uid()` on all operations.
2. Authenticated role has SELECT/INSERT/UPDATE only; anon has no privileges. No unprotected view, service-role browser key or SECURITY DEFINER function.
3. Candidate JSON is bounded to 1–100 public business listings; each requested job size is 12/25/50/100.
4. `claim_deep_scan_batch` atomically leases a pending or expired batch with a private token and a 90-second expiry.
5. `finish_deep_scan_batch` requires live token, positive processed count ≤6, and bounded counters; transitions to completed at the last candidate.
6. `pause_deep_scan_batch` terminates the current owner's token with short error text; no silent destructive requeue.
7. No cron, job consumer or self-triggered browser timer. Each six-business batch requires an explicit owner action.
8. Prospect write path reuses prior curation, stable-identity dedup and protected outreach restrictions. Existing client/lead records are not automatically deleted or demoted.

## Acceptance tests before release
- CI TypeScript, full pure-module scanner tests and production build, including 100-candidate / 17-batch tests.
- Local ephemeral Supabase migration replay, role-scoped RLS tests for anon/non-admin/admin, and concurrent claim/expire/retry tests.
- Browser mobile/desktop scan progress, pause/resume/cancel, and Quick Scan regression tests.
- Confirm zero production DB changes from PR review; owner approves migration inventory separately.
- After owner-authorized migration/deploy, run controlled 25-business scan first, verify counts, resume after refresh, and compare prospect IDs against existing records.
- Only then consider automatic scheduling/queue consumers.

## Current limitation
The feature is **manually resumable**, not 100 automatically audited businesses in one click. Directories may return fewer candidates than requested. Contact data is scored for confidence, never represented as independently verified unless matching public evidence exists.


## 2026-10-28 integrated safety review (draft PR #46)

This integrated draft is based on the newest scanner intelligence branch (PR #45).
It supersedes the unintegrated feature code in PR #37 for review purposes,
but the earlier PR remains open as its reference. Never merge both.
The original migration file is carried forward unchanged, deliberately keeping
the migration-inventory release preflight locked until separately approved.

Additional gates applied in the integrated server action:
- Every six-business batch reads the COMPLETE bounded saved prospects, leads,
  and existing clients. Missing or truncated reads safely pause the batch
  before writing any business prospect.
- Uses the shared conservative business-identity classifier across current
  clients/leads/prospects and within a new six-business batch.
  Ambiguous identities are held for manual review, not saved or merged.
- Existing contacted/drafted/promoted/archived prospects are protected;
  only a known, uncontacted same-source record may use guarded refresh logic.
- Saves current Business Verification, niche website evidence, Scan Memory,
  search territory/radius and curated reliability signals together.
- Continues owner-invoked six-candidate steps, source-indexed discovery and
  database lease consistency.

Required before main merge or migration application:
1. Obtain explicit owner approval of migration 20261028090000_deep_scan_jobs.sql.
2. Verify live schema migration inventory against exact source versions,
   including already-applied 20261017030000 and 20261020063055; NEVER bypass inventory guard.
3. Run isolated RLS and concurrent-worker lease tests, plus negative client
   duplicate collision tests with disposable Supabase auth roles.
4. Review and approve Nocturne visual preview; merge only the integrated
   branch in proper dependency order after release gates pass.
5. Recheck no-auto-send and owner-click-only processing in production smoke QA.

Nothing here authorizes migration application or production deployment.
