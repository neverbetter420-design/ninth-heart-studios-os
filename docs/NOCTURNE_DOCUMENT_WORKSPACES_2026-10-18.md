# Nocturne — Contracts, fillable forms and text templates

The three document tools now share the open Nocturne management canvas, editorial headings, a ruled metric strip, labelled cross-navigation and readable directory rows. Creation is a native keyboard-operable disclosure. Forms retain a separate PDF import disclosure; creation errors reveal both form entry points because the existing redirect does not identify which submission failed.

The tools retain distinct purposes:

- **Contracts** hold agreement terms and the existing click-to-accept signature record. The directory filters by recorded status. Draft workspaces lead with the terms editor, offer optional template replacement, and separate sending and record controls. Sent, signed and voided terms remain read-only. Signed agreements show the recorded signer, email, Pacific timestamp, IP and document hash.
- **Fillable forms** hold fields and collect client responses. The builder separates fields, form metadata, sending and submissions with visible local destinations. All eight existing field types remain available. Inactive forms are reachable through the directory and cannot be sent from the UI until activated. PDF imports remain inactive for review, retain the existing private source URL flow, and show a recoverable notice if the source link cannot be generated. Submission rows link to their project resources.
- **Text templates** supply reusable contract bodies and project-document notes. Active and archived templates have real workspace links; archived copy can be edited or restored. The focused editor explains that changing a text template does not rewrite documents already created from its content.

Category and availability filters preserve one another. Unknown category/status query values fall back to the normal directory. Read failures produce unavailable counts and recovery notices, rather than false zero/empty states. Detail reads distinguish a failed query from a genuinely missing record. Related choice failures disable the unavailable choices; form sending is also disabled when project choices are unavailable.

## Implementation and verification

`components/documents/DocumentChrome.tsx` owns shared document navigation, disclosure headings, notices and Pacific timestamp display. `app/nocturne-documents.css` extends the existing management canvas, with narrow-screen layouts, visible focus and controls of at least 44px. All existing action names, submitted field names, authorization gates and database/storage policies are preserved. Explicit editor/dropdown names keep saved textarea content and option text out of their accessible names; regression checks cover prefilled controls. Opportunity-only agreements explain that client signing requires a project with portal access. Native forms use the existing pending submit control; these pending labels do not assert that a write succeeded. The legacy redirect/revalidation action outcome model is unchanged.

Source-rendered browser cases cover all six routes at 320–1440px, long unbroken titles and copy, empty/filter/archive/error states, template-choice failures, sent/signed/voided contracts, signature evidence, inactive sending, project/submission read failures, private-source failures, eight field choices, keyboard disclosures and local destinations. All preview reads are synthetic and network requests are blocked.

The strictly guarded disposable-local Supabase walkthrough adds real UI creation/edit/archive/restore of a text template, copying it into a contract draft, saving/sending, client signing and persisted signature evidence. It also creates a required form field, sends a form to the entitled client, submits and reads back its answers, archives/restores the form, and imports a small synthetic AcroForm PDF. The import check verifies inactive review, extracted fields and a private signed source link. Desktop/mobile previews are captured from synthetic records. Hosted write QA is not run by these tests.

Final commit check results and review artifacts are recorded in draft PR #14. Automated checks and sample-data images do not constitute owner visual acceptance.

## Release boundary

Draft PR #14 only. No production deployment, hosted data/schema mutation, migration execution, Auth/Storage/DNS configuration, automation activation or outbound messages. The original logo geometry is unchanged. The verified-restorable-backup and distinct production approvals remain release gates.
