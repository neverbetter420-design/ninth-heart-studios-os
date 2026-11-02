# Muse owner-isolation hardening: implementation gate

Source-only review branch based on PR #67 at `3b6a08915b6a193d3f44eba7394c2f6220e9d5d0`. No production changes authorized.

## Required negative tests (disposable local Supabase only)

1. Create admin A and admin B with separate projects. A must not be able to insert a Muse draft referencing B's project. Assert no plan or revision row was created.
2. If a fixture can create a cross-owned plan using a privileged setup role, A must not save a revision or apply it. Assert no tasks or activities were created.
3. Call the exposed save/apply RPCs as anon, non-admin authenticated, admin A against B's plan, and admin B against A's plan. All must fail with no writes.
4. Confirm private SECURITY DEFINER functions are inaccessible through the public Data API and cannot bypass owner checks when called by an authenticated role with schema usage.
5. Concurrent updates with the same expected revision: exactly one succeeds, one conflicts; history remains consecutive and immutable.
6. Stale apply and mismatched expected task count: reject atomically with zero tasks, activities or status changes.
7. Backfill with invalid legacy plan data must fail the migration transaction, not leave partially applied schema changes.
8. Validate task and subtask JSON schema, date, numeric bounds and 48-task cap at the database boundary, not just TypeScript.

## Source inspection notes

The v2 candidate checks `muse_project_plans.created_by = auth.uid()` in privileged save/apply routines, but does not independently verify that `public.projects.id = project_id` is owned by the same admin. This must be verified against actual project ownership schema and RLS, then fixed if missing.

Do not add a permissive RPC or weaken existing policies. Any fix must enforce project ownership at draft INSERT and privileged save/apply, preferably with shared, narrowly scoped ownership checks.

## Release gates

No merge, Cloudflare deployment/build-setting changes, hosted migration, Muse activation, paid AI, lead scans, outreach, or changes to real users. Run all nine exact-head GitHub Actions workflows and local disposable Supabase tests after any implementation change. A passing offline Worker dry-run does not create or authorize an online preview.
