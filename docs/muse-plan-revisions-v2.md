# Muse Project Guide: versioned editing contract (source-only)

Status: **design and pure local contract only**. This branch does not enable Muse, alter a hosted database, register an API route, send requests, create tasks, deploy, scan leads, or message anyone. PR #60 (complete plan-review visibility) is a separate prerequisite.

## User experience

1. Admin generates a private plan. The app shows **draft revision 1** and the entire proposed contents.
2. Admin may edit summary, title, description, completion criteria, priority, due date, estimated focus time, and client visibility; add/remove parent tasks and one-level subtasks; or discard.
3. Each successful **Save revision** creates one immutable revision snapshot and a clear reviewable difference. A browser-local edit is not authoritative and must never imply saved.
4. Saving requires a server-verified **expected_revision** matching the database's current revision. Conflicting updates return 409 and demand a fresh reload. Silent last-write-wins is forbidden.
5. The final approval screen shows the **exact persisted revision** and client-visible changes. The admin approves once for that revision and project, not for "the latest draft".
6. Apply requires a guarded RPC that checks **plan_id + project_id + expected_revision + expected task count** under a row lock, then creates exactly the approved tasks and a versioned activity receipt, or no tasks.
7. A newer revision, expired draft, rejected draft, or already applied draft cannot be approved with an old browser tab.

## Proposed database changes (NOT applied here)

- Introduce immutable public.muse_project_plan_revisions ledger:
  - plan_id uuid references public.muse_project_plans(id) on delete cascade
  - revision integer check (revision between 1 and 25)
  - plan jsonb (exact validated snapshot)
  - change_summary text, created_by uuid references auth.users(id), created_at timestamptz
  - primary key(plan_id, revision)
- Add current_revision integer not null default 1 to muse_project_plans.
- Backfill existing draft and applied plans with revision 1, preserving existing approval state. Do not alter original plan, source_model, created_by, or created_at.
- Protect ledger rows from UPDATE/DELETE (database privilege, trigger/policy, not merely UI rules). Restrict all reads/inserts to the active owning admin; clients/anon have no access. Consider a private schema or privileged function after a full security review. Do not allow direct REST edits to bypass the version ledger.
- Provide an atomic, authenticated security-reviewed RPC for edit + compare-and-swap + append. Validate each field, maximum 12 parents, 8 children per parent, 48 total tasks, non-nested subtasks and at most 25 revisions.
- **Replace/decommission the existing one-argument** apply_muse_project_plan(uuid) permission path before enforcing revision-bound approvals. The old callable function would bypass the revision check.
- Preserve v1 row-level security and SECURITY INVOKER access checks unless a fully reviewed alternative is necessary. Current authenticated direct-update grants need review before claiming an immutable ledger.
- Align edit/apply API responses to plan_id/project_id/revision/expiry/plan and applied_revision/created_count; reject mismatched approval receipts.

## Local contract shipped in this branch

lib/muse-plan-revisions.ts provides pure **unpersisted** revision transitions:
- accepts only explicitly enumerated edits;
- checks identity, expected revision, bounded field values and plan shapes;
- rejects invalid indices, unknown keys, stale versions, no-op edits and revision 26;
- clones before edits, keeping earlier snapshots intact;
- reuses the existing project-plan parser to reject malformed and oversized results.

This helper is deliberately **not wired to the live UI or database**. Its revision counter models the eventual authoritative RPC, not a substitute for locking or audit history.

## Required acceptance tests before enabling

1. Run pure contract tests (npm run verify:muse), TypeScript, and the production build.
2. On disposable local Supabase, prove concurrent saves of revision N result in exactly one success and one conflict.
3. Prove client/anon cannot read or modify revisions, and one admin cannot edit another admin's plan.
4. Prove direct REST writes and old RPC signatures cannot bypass the revision ledger or approval audit.
5. Expired/rejected/applied/stale plan approvals produce zero new tasks; duplicate approval is rejected.
6. Test mobile/desktop editor, diff, client-visibility warnings, refresh, dropped network response, and back-button behavior using synthetic data.
7. Test original and edited plan retention, task visibility defaults, and exact audit receipt contents.
8. Review the concrete migration, disabled flags, budget, rate limiting, and full CI before any production request.

**Non-goals:** automatic AI activation, paid models, unattended edits, outreach, scans, messaging, or edits to existing client tasks.
