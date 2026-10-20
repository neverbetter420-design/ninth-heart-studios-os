# Nocturne Atelier — Client Atelier and Creative Studio

This continues the owner-directed Nocturne correction after the rebuilt Command Center. The client experience now uses an open ivory canvas with champagne/plum drapery, a personalized editorial welcome, one featured project and a clear next decision. The dark admin and light client workspaces share structure and typography while retaining separate palettes.

## Composition

- Client Home: the framed dark welcome and boxed project card are replaced by an open welcome, ruled project overview, one next-step column and a compact directory. Project names, approval requests and progress remain real session-scoped reads. The approval teaser avoids claiming an exact total from a limited query.
- Both project workspaces: a shared seven-phase journey uses the existing canonical pipeline stages. It identifies the current phase; earlier positions are not labelled as completed. On-hold and unknown states do not fabricate a current phase.
- Client project: Project Plan, Files & Documents, Design Feedback and Conversation are separate native disclosures. Project-destination links carry a section parameter and anchor so the requested group opens before its content is reached. A small client-side section link also reopens manually collapsed sections when the same URL is already current or cached. Pending approvals remain visible.
- Admin project: priorities remain visible. Design Feedback, Files & Documents, Conversation and Delivery have separate destinations and disclosures. Existing edit, task, milestone, approval, upload, document and message forms are retained.
- Design Gallery: up to three supported image files from the page's existing scoped file query are displayed through the already-generated private signed URLs. It renders nothing if no supported readable image exists; it does not invent designs, change file visibility, or create public URLs. Raster formats are allowlisted; SVG and document files remain accessible through the file section.

`app/atelier-studio.css` owns these compositions. Superseded home and workspace rules were removed from `app/nocturne.css`. The original logo master is still pending; decorative ribbons are not replacement logos.

## Verification and limits

- Local TypeScript, navigation checks and Next.js production build passed during implementation.
- Twelve isolated visual cases cover desktop/mobile, 320–1440px widths, long titles, empty/error states, progress containment, focus, readable sidebar controls, file-group visibility and gallery presence/absence.
- The stress cases caught and corrected a 12-column grid-gap overflow and an unbroken admin approval-title overflow. Controls now fit without hiding page overflow.
- Disposable-local Supabase UI coverage now clicks each client project destination, verifies document deep-link opening and same-link reopening after manual collapse, captures client project previews, and retains approval/message persistence and cross-client rejection checks.
- Separately gated write-QA source now opens the relevant resource disclosures after navigation/reload; its immutable production-test-project guard and approval gates are unchanged. No such hosted write tests are run by this design task.
- Final-commit GitHub app, browser, PostgreSQL security, disposable local Supabase and Cloudflare bundle checks must be inspected before claiming the final draft verified. Synthetic image fixtures and screenshots are not production client assets or owner visual approval.

## Release boundary

Draft PR #14 only. No production database, Auth, Storage, DNS, automation, migration, merge or deployment changes. Existing backup, security-migration and separate production approval gates remain in force. Owner visual acceptance is still required.
