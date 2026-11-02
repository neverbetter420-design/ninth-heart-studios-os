# Muse Project Guide v4: immutable history and deliberate restoration

**Status: SOURCE-ONLY STACKED DRAFT.** Depends on PR #63 (editor) and PR #62 (candidate immutable ledger). Both remain unmerged. No hosted Supabase migration or Cloudflare production release is authorized.

## What changed

- The guarded Project Guide API can list up to 25 historical revision summaries for an **active, owner-owned draft**. Each entry has a revision number, timestamp, change reason, sanitized plan summary and task/client-visible counts. Complete plan bodies are not included in the index response.
- Selecting a history item fetches only that particular snapshot and checks project, plan, owner, revision, current revision and expected metadata. The route checks expiry, status, and the latest ledger snapshot matching the stored plan.
- A responsive timeline lets the admin compare an older snapshot against the current plan with a before-and-after diff and client-visibility warnings.
- **Restore means open an unsaved copy in the editor.** The user must review and save it as revision N+1 using the existing owner-bound compare-and-swap RPC. History is never updated or deleted by the UI. Task creation stays a separate explicit exact-revision approval.
- History reads are purely database reads behind the existing feature flag and same-origin/admin session checks. They do not trigger AI model calls, outreach, scans, or spending.

## Invariants

1. Only the authenticated, active plan owner may view a proposal's history. RLS in PR #62 independently enforces owner access on each revision row.
2. A stale or tampered history index (non-consecutive numbering, invalid body/counts, missing current revision, mismatched project/plan receipt) fails closed.
3. At most 25 revisions are supported. At 25, historical browsing works but restoration cannot create a 26th revision.
4. The API does not expose a direct historical overwrite or apply route. Restore-to-edit is client-local, and every save requires a separate current CAS revision and change note.
5. A recovered snapshot cannot bypass validation, visibility review, and explicit confirmation.
6. No writes to hosted Supabase, no production migration, no production deployment, no Muse activation, no client communication, no paid AI.

## Tests and review

`npm run verify:muse` includes offline source contracts for ownership and non-destructive restoration. The isolated synthetic Muse editor browser suite tests desktop and mobile version listing, snapshot comparison, restore-to-unsaved-editor, exact current-version save, and subsequent separate approval.

The independent PR #62 local Supabase security suite and PR #63 editor tests must stay green; this PR is **not** safe to merge before its dependencies and fresh CI checks are separately reviewed. No production release is implied by CI passing.

Known limitation: History can be browsed only while its parent draft is active and unexpired. Once approved or expired, immutable rows remain in the DB but the UI intentionally blocks access until a separately reviewed read-only archive endpoint is built.
