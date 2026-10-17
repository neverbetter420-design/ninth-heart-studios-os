# Phase 2: controlled authenticated write QA (NOT YET RUN)

## Current safety status

The read-only authenticated browser suite passed 12/12 on GitHub run 39014641705. The next suite is a *staged, opt-in* Playwright test file at `tests/e2e/write-actions.spec.mjs`. It is intentionally skipped during PR workflows and ordinary local/browser tests. **No live Supabase writes have been run by Phase 2.**

The `ninth-heart-studios-os` Supabase project currently contains separate test records named `Client A Test Co. Website` and `Client B Test Co. Website`, each with one client membership (read-only check). These are **test records in the existing live Supabase project**, NOT a separate staging database. No other customer project can be selected without failing the guarded test project's exact name check.

## Explicit execution gates

1. Use a protected, manually dispatched GitHub workflow pinned to a reviewed feature-branch commit. The existing read-only workflow on main must never be converted to silently run writes.
2. Require `NHS_QA_WRITE_APPROVAL=I_APPROVE_ISOLATED_QA_WRITES`, a specified `NHS_QA_TEST_PROJECT_ID` UUID, all six existing `E2E_*` login secrets, and a separate explicit approval to write to *these existing test records* before dispatch. Without the approval phrase, project ID, or credentials, **all write cases skip**.
3. Before **each** write, the test signs in as Client A, proves the selected project exists in Client A's portal and has exact heading `Client A Test Co. Website`, then signs in as Client B to prove that same direct link is denied. Finally it signs in as Admin and checks the exact project heading and `Client A Test Co.` ownership.
4. Writes use only unique `NHS-WRITE-QA-<run-id>-<timestamp>` names on this designated project; never reuse real customer titles or remove unmarked records. The suite does not use a service-role key, schema changes, migrations, or permission edits.
5. Every attempted creation uses `try/finally` to locate and delete only its own exact named record, then refreshes to verify removal. On a rejected or partially committed storage cleanup, **stop and reconcile manually** instead of blindly retrying. Activities/audit rows are not automatically erased.
6. Use one test runner at a time, and review the report, project task/document/file rows and private storage after a run. No automatic merge, deployment, cron/automation activation or publish.

## Prepared cases

| Case | Assertions |
|---|---|
| Task | Admin creates client-visible task; row survives refresh; Client A sees it; status persists; hide-from-client takes effect; exact-created row is deleted. |
| Milestone | Admin creates milestone; Client A sees it; completion survives refresh; exact-created row is deleted. |
| Project document | Admin shares a harmless example.com test link; confirms persistence and Client A visibility; exact-created document reference is removed. Original linked content is never touched. |
| Private file | Upload a harmless text canary in the project-files bucket, verify a signed download link and Client A visibility, then remove only the canary file metadata/storage entry and verify absence. |

### Remaining scope

- **Membership add/remove** needs a third disposable, nonessential client user with no other memberships, or its own rollback-safe isolated fixture. Do **not** remove Client A or Client B's existing memberships just to test revocation.
- Test real approval decisions using a *new disposable approval*, not an existing client's pending decision. Such tests need an approved fixture-creation/cleanup plan.
- Edge cases: denied writes, expired sessions and network disconnects; verify no misleading success notifications and no duplicate records. Mocked action tests currently cover many of these logic paths, but not real network/rejected writes.
- Add a separate protected manual write-QA workflow to main **only after explicit approval**. It must have credentials and approval input, pin the reviewed commit, accept only the selected test project UUID, and never run on PR/push events.
- After a successful approved test, inspect cleanups and cross-client RLS again before considering production deployment of PR #14.

The currently deployed Cloudflare Worker, other project data, Supabase policies, and live automation configuration remain untouched by these preparations.
