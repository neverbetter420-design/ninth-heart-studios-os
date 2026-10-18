# Nocturne — Client relationships and project pipeline

Client Management now uses an open directory with contact information, project/member counts, status labels and one clear workspace destination. New-client creation remains a native disclosure. Archive/restore moved into the client workspace alongside the relationship status, while the project list leads that workspace and membership controls have their own visible section and local navigation.

The client workspace retains account-email membership lookup, pending/success/error feedback, scoped removal and its existing confirmation. It explicitly explains that archiving preserves memberships. A New Project link carries the current active client into the pipeline creation form. An archived client can be restored in its workspace; read errors never present missing project/member data as an empty result, and membership changes are disabled while its member read is unavailable.

The horizontal eight-column pipeline is replaced by vertical, ruled phase groups and a compact phase directory. All canonical phases remain visible when projects exist. On Hold sits outside the seven numbered phases; unknown statuses have a separate Needs a Phase group rather than appearing under Discovery. Active counts include only canonical forward stages. Each project links to its workspace and shows recorded progress and date cues. Change Phase opens the existing move form, including all seven forward choices and On Hold. Unknown statuses require an explicit valid selection. A confirmed move uses opt-in persistent feedback so its result remains visible when the form moves to another phase; it adds no confirmation dialog and never announces success on a failed or unconfirmed action.

`components/projects/ProjectDirectoryRow.tsx` supplies the shared project rows. `lib/project-display.ts` keeps progress within its display track and treats due dates as Pacific calendar dates, with date-only formatting independent of the server timezone. These helpers do not write or recalculate stored progress. `app/nocturne-management.css` owns these compositions; replaced pipeline and creation-panel rules were removed from their older stylesheets.

## Verification

- Local source-rendered cases cover long unbroken client/project/member names, empty collections, archived clients, form errors, unavailable projects/members/client choices, preselected project creation, all phases, unknown statuses, progress containment, keyboard disclosures and 320–1440px layouts.
- Delivery checks cover invalid dates, Pacific midnight boundaries, the seven-day due window and display-only progress bounds. Existing isolated admin-action verification remains in place.
- Disposable-local Supabase UI coverage now creates a client, creates its preselected project, moves and reloads the phase, adds an existing client account, verifies project access, removes that one membership, verifies lost access and retained access to the account's original client, then archives/restores the new client. Both desktop/mobile cases use the existing strict CI-localhost guard. Hosted write QA remains separately gated and was not run.
- Final-commit CI results are recorded in draft PR #14. Sample-data previews and automated checks do not constitute owner visual acceptance.

## Release boundary

Draft PR #14 only. No hosted data, Auth, Storage, DNS, automation, schema migration, merge or deployment changes. The verified-backup and distinct production approvals remain required. The original logo master is still pending and its geometry has not been altered.
