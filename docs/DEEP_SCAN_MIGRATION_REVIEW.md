# Deep Scan database migration review

**Review-only, not applied.** Migration: `supabase/migrations/20261028090000_deep_scan_jobs.sql`.

## Why it is needed
The existing scanner runs up to 12 business checks in one request. Longer scans need persisted candidate queues, position counters and an atomic lease so repeated taps or interrupted Cloudflare requests do not process the same segment concurrently. This table is a private, admin-owned queue for **on-demand** work only; it creates no timers, no scheduled jobs, no AI API calls and no new outward messages.

## Existing production baseline
- Existing review guard in `scripts/verify-release-preflight.mjs` expects 22 applied migration versions + one separate proposed security migration (`20261017030000`) = 23 source SQL files.
- This draft adds **one** new migration, taking the source tree to 24 and intentionally tripping the guard.
- **Do not remove the guard or silently increase the expected count.** Before merging, compare actual `supabase_migrations.schema_migrations` on the authorized environment, review the outstanding 20261017030000 proposal, approve the Deep Scan migration explicitly, and update the guarded inventory with a complete owner-reviewed list.
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
