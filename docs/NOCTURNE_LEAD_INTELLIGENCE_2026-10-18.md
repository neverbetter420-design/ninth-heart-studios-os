# Nocturne — Lead Intelligence

Lead Intelligence now follows the open Command Center direction. The ranked queue is the main working area, with a compact capture column, editorial heading and four metrics in a fine-rule strip. Capture begins with business name and acquisition; a keyboard-operable native disclosure holds the optional contact fields and score. Existing form errors open those fields for correction.

The lead workspace keeps the next action, inbound SLA and elapsed activity time visible. Conversation outcomes and the timeline occupy the main column; contact details, consultation scheduling and an explicit project-conversion disclosure form the context rail. All six quick outcomes, field names, server actions, ranking rules and caller-scoped queries are retained. A failed list read is reported as unavailable, rather than as zero active leads.

`app/nocturne-leads.css` owns both compositions. Replaced lead-specific rules were removed from `app/phase3.css`; its shared form and dashboard utilities remain. The Lead Scanner is linked from the header and retains its current layout for a later consistency pass.

## Verification

- Source-rendered browser cases cover populated, empty, unavailable and form-error states, unbroken business names, long contact details, keyboard disclosures, optional fields retained in FormData, all outcome forms and scheduling/conversion controls at 320–1440px.
- The disposable-local Supabase UI test now captures a lead, reads back its contact details/score, logs Received Reply, checks reply priority, schedules and reloads a consultation, opens the lead from its queue, and converts it into a persisted Discovery project with the linked client. Desktop and mobile use the existing strict CI-localhost guard. No hosted write QA is included.
- Final local and GitHub check results belong in the draft PR validation section. Synthetic screenshots show draft components, not customer records or owner visual acceptance.

## Release boundary

Draft PR #14 remains unmerged. No hosted database, Auth, Storage, DNS, automation, migration or deployment changes are included. The verified-backup and separate production approvals remain release gates. The shell logo is still temporary; the original master geometry has not been changed.
