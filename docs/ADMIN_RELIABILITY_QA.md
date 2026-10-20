# Admin reliability verification

This phase covers client membership add/remove, task create/status/visibility/delete, milestone create/status/delete, project document share/remove, and private project file deletion. Success requires a returned matching Supabase row; a rejected write or zero-row result produces an error. Actions continue to use `requireAdmin()` and the signed-in user's Supabase client. No schema, RLS, grants or storage policies changed.

Pending forms disable their controls. Failed forms preserve entered values. Transport failures with an unknown persistence outcome tell admins to refresh and check the record before retrying, avoiding duplicate submissions. Repeatable create forms reset only after success. Membership, task, milestone and document removal require confirmation; a page-level notice remains after the removed row disappears. Document removal keeps linked originals and uploaded files. Document links accept only HTTP/HTTPS. Private file deletion is separate: it confirms the file metadata deletion first, then asks Supabase Storage to remove the private object. A failed storage cleanup is reported as partial completion without claiming a successful deletion, and requires an admin reconciliation rather than a blind retry.

## Verification scope (CI is authoritative for the latest commit)

- TypeScript and all existing feature verification scripts passed.
- `verify:admin-actions`: isolated server-action cases cover saved-row confirmations, invalid inputs, permission denials, missing records and file deletion ordering against mocked dependencies; no network or database access. Exact count and current result must be taken from the latest GitHub workflow.
- Desktop/mobile Chromium includes the shared form/notification fixture and real public/anonymous-route checks. The fixture now includes an unconfirmed server response test. Exact passing/skipped counts must be checked against the current workflow.
- Next.js production build passed.
- OpenNext Worker bundle and Wrangler `--dry-run` passed without publishing. Local Windows compatibility and experimental Node.js middleware warnings remain; the PR's Linux CI validates the final commit as well.

## Authenticated QA still required

Use dedicated admin and two isolated client accounts. PR-triggered browser runs intentionally receive no login secrets. The existing navigation suite is read-only even when credentials are configured; the following mutation checks need an isolated test project and deliberate execution.

| Workflow | Required authenticated checks |
| --- | --- |
| Client access | Add an existing account, verify the membership survives refresh and grants only the intended client's portal resources. Check unknown email, duplicate membership and denied writes. Cancel removal and verify access stays; confirm removal and verify access is revoked after refresh while the account and other memberships remain. |
| Tasks | Create internal/client-visible tasks; refresh and verify saved title/date/priority/status. Check client visibility and concurrent changes. Cancel/confirm deletion and verify both admin and client views. |
| Milestones | Create, change status and refresh admin/client views. Verify failed updates do not report completion. Cancel/confirm deletion. |
| Documents | Share links and active-template notes; refresh and verify client visibility. Check unavailable template and rejected writes. Cancel/confirm removal; verify original files/links remain. |\n| Private files | Upload/download with correct client/internal visibility. Cancel deletion and verify no write. Confirm deletion and verify both metadata and Storage object removal. Force a mocked storage cleanup failure to verify the partial-completion message; reconcile manually in isolated testing. |
| Feedback | Exercise actual server validation, denied writes, expired sessions and lost connections on desktop/mobile. Confirm pending controls, preserved input, success notices and refresh-before-retry behavior. |
| Isolation | Direct-link into the other client's project and resources as each client. Verify current deployed RLS and session behavior, especially after membership removal. |

Mocked responses prove action control flow and feedback handling, not current deployed RLS, authenticated server submissions, cross-client isolation or session propagation. Those items are not represented as passed.

No merge, deploy, automation activation, live record changes or permission changes were performed by these checks.
