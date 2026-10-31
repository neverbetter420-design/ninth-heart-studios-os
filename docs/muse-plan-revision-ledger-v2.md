# Muse Project Guide v2: revision ledger and exact approval

Status: **SOURCE-ONLY DRAFT**. No hosted Supabase migration, live feature flags, paid AI, production deploy, lead scan, outreach or client message has been performed.

## What this PR adds

- A **versioned, append-only** revision ledger in public.muse_project_plan_revisions. Existing stored plans are backfilled as immutable revision 1 and subsequent inserts receive revision 1 by a private trigger.
- Row-level security on the ledger and owner-scoped draft reading. Authenticated admins get **SELECT only** on revisions and **SELECT + INSERT only** on plans. Direct REST UPDATE/DELETE and direct ledger writes are revoked.
- A private, fixed-search-path SECURITY DEFINER write implementation with explicit session identity, active admin, owner, project, status, expiry, version and ledger-consistency checks. Public PostgREST RPC wrappers remain SECURITY INVOKER and narrow in purpose.
- Optimistic **compare-and-swap** editing under SELECT FOR UPDATE and an immutable revision record. Only revisions 1 through 25 are allowed, with no silent overwrites or empty edits.
- A new exact-version apply RPC requiring project ID, plan ID, expected revision **and expected total task count**. It replaces and revokes the old one-argument RPC so old tabs cannot apply a newer, unreviewed plan.
- The existing task-creation loop remains transactional, with ledger/count checks before task creation and a private activity receipt recording the applied revision.
- The admin API has guarded save_revision/apply actions; the proposal preview displays its revision and submits exact approval parameters. A full editing UI, diff view, and revision recovery are **not yet shipped**.
- Additional source-contract checks and updated synthetic browser fixtures.

## Security and behavior boundaries

The client cannot edit tasks or revisions through direct table mutations. Edits go through a version-checked RPC. Access to public RPCs still depends on authentication, active admin, the same-origin API and the MUSE_PROJECT_GUIDE_ENABLED flag, which remains **off**. No OpenAI calls are made by local tests.

A private SECURITY DEFINER function is used only to bridge intentionally revoked UPDATE/DELETE privileges for ordinary users. This is a security-sensitive exception requiring a local Supabase/PostgREST threat-model review before any hosted migration approval. The private schema must remain **unexposed** through PostgREST. Do not grant schema usage or direct RPC execution to anon. Existing private.is_admin() authenticates through the server-controlled profile row.

## Before merging or applying

1. The ephemeral Supabase CI workflow must apply the complete migration chain without connecting to the hosted project.
2. Run real role tests for admin/other-admin/client/anon: direct UPDATE/DELETE/INSERT revision denial, owner-scoped history SELECT, authenticated draft insert with trigger, and denied access to someone else's plan.
3. Test concurrent revision saves. Exactly one must succeed when both submit the same expected revision; the other must fail. No stale save may mutate the plan or ledger.
4. Test exact project, revision, task-count, expiry and status failures in apply with **zero tasks** created. Verify duplicate applies and old one-argument RPC are rejected.
5. Ensure malformed JSON, fabricated client-visibility changes, excessive subtasks, 26th revision, mismatched receipts and rolled-back writes are rejected.
6. Perform synthetic desktop/mobile review and Playwright checks, TypeScript checks, Next/OpenNext build and local Wrangler dry-run. No publishing.
7. Build the editable UI with full before/after diff, explicit client-visibility warning, no-op handling and saved-version reload before considering activation.
8. Review a fresh read-only Supabase security advisor report and gain **separate** explicit authorization for any production migration, deployment or AI activation.

## Known release considerations

- The migration uses a **manually authored filename** because the Supabase CLI was not available in the authoring environment. CI must verify the timestamp order and complete migration chain.
- This backend-only revision milestone does **not** provide finished end-user editing. Only the typed local revision helper from v1 and the guarded RPC are available for follow-on integration.
- Any promotion of this branch requires a separate review of changes to privilege grants and the callable private functions. The presence of an AI binding or secret does not authorize paid model usage.

Review branch: feat/muse-plan-revision-ledger-v3.
