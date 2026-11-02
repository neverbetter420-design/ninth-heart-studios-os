# Muse Project Guide v3: deliberate plan editor (stacked draft)

**Source-only and disabled by default.** This branch stacks on PR #62 (`feat/muse-plan-revision-ledger-v3`). It cannot be independently merged into `main` or deployed. The plan revision SQL remains in `supabase/migration-candidates`, not the 26-file production migration inventory.

## Experience

- Reopen the newest non-expired owner-bound saved draft for the current project through `load_latest`, without a model call.
- Edit summary; parent tasks and one-level subtasks (title, description, completion criteria, priority, due date, focus estimate and client visibility); add/remove tasks and steps within v1 schema bounds.
- Preview before/after changes, explicit changed task counts, and **newly client-visible** items. Mark *this exact JSON edit* reviewed. Any edits after review invalidate the confirmation.
- Require a meaningful change note, then save using PR #62's **expected_revision** compare-and-swap RPC. Saving a revision never creates a project task.
- Acknowledge a save only after verified ID, project, monotonically increasing revision and exact normalized plan content. On failed/uncertain writes, close stale approve controls and require a fresh server reload.
- Exact revised task count and revision remain necessary for a later, separate task-creation approval.

## UI/UX boundaries

- No automatic client publishing, outreach, email, data scans, AI model calls, or background updates. Reopening is a narrowly scoped read.
- The live `MUSE_PROJECT_GUIDE_ENABLED` flag remains disabled; the editor is visible only within the gated Project Guide.
- The first save/edit session is ephemeral browser state; revisions are only authoritative after the server confirms the new snapshot.
- The dark glass interface uses disclosed task sections and a short diff-first review. Mobile displays one-column fields and full-width actions.
- The current version reopens the **latest saved draft**, not an arbitrary historical revision. The underlying immutable ledger preserves previous versions for later audit/recovery UI.

## Verification and remaining gates

1. `npm run verify:muse` includes offline tests for before/after diffs, visibility exposure, validation, owner-scoped reload, and reviewed-save guards.
2. `.github/workflows/nocturne-pages-qa.yml` runs the synthetic desktop/mobile editor: edits, client-visible warning, changed-after-review block, saved receipt, reload, exact revision apply, stale conflict, and no external calls.
3. CI also runs TypeScript, full build/Cloudflare dry-run, standard Playwright, and PR #62's full disposable Supabase security workflow.
4. The base migration/PR #62 needs its own independent security review and **explicit authorization** before merge, and production migration would require a separate approval. This stacked PR also requires separate review/merge authorization.
5. No GitHub Actions workflow deploys production for a pull request. Production Cloudflare and hosted Supabase are unchanged.

Known non-goal: a complete browsable history or revert editor. Existing versions are immutable and can be added to a dedicated read-only history screen in a later milestone.
