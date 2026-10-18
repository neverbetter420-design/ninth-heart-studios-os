# NHS Nocturne: Atelier Edition — Final design review

The redesigned studio is ready for an owner visual review in draft PR #14. This is the current review guide; older visual acceptance notes describe earlier compositions and are historical evidence. Owner visual acceptance is still pending. The live app is unchanged.

## The intended experience

| Area | What to look for |
| --- | --- |
| Command Center | A dark, open welcome; three priorities, active work and recent activity; restrained decoration |
| Growth | A ranked lead queue, optional capture, evidence-led scanner and a considered opportunity shortlist |
| Clients and projects | A clear client directory, relationship workspaces and a vertical seven-phase pipeline; On Hold stays separate |
| Documents and studio tools | Focused contract/form/template editors; Muse separates thinking, drafting and saved work; settings and automation status state what is actually known |
| Client Atelier | Warm ivory and plum, one current project and next action, separate Messages, Files, Approvals and Documents destinations |
| Creative Studio | Clear project stages and section links; shared work, conversation, resources and delivery open independently |

## Consistency corrections

Menu selection and breadcrumbs now use one role-scoped route context. Client Contracts and Forms stay under Documents, show their own names and provide a working Documents return link. Project, client, lead and document detail breadcrumbs use “workspace” consistently. Text templates and Settings use matching menu/breadcrumb names. A single form field now reads “1 field.” Lead Scanner now shares the editorial header, open scan controls and ruled prospect list; missing-website priority remains 10 and listed/linked social verification is unchanged. Scanner read failures show an unavailable count rather than an empty queue. No routes, permission rules or business action implementations changed in this pass.

The final authenticated walkthrough visits all twelve admin and six client menu destinations by clicking the real navigation. It checks the two nested client paperwork destinations and return links on desktop/mobile. Captures start at scroll position zero and preserve input caret attributes, avoiding screenshot-induced hydration warnings. A console check fails the walkthrough if a hydration mismatch occurs. This is an actual rendering check, not suppression of React warnings.

## Review order

1. Start with Command Center on desktop. Does the open composition feel like NHS, and is the next action obvious?
2. Review the client home and project workspace. Can a client find conversation, files and paperwork without reading a dashboard full of controls?
3. Check one lead, client, opportunity and contract/form editor. Is the working area clear, with secondary controls kept out of the way?
4. Repeat Home, navigation, Documents and a project on mobile. Check text size, spacing, menu dismissal and return paths.
5. Reply with visual approval or a page name and the adjustment wanted. Design approval is separate from production release approval.

## Evidence and screen index

Final-commit workflow links, counts and the current review artifact are maintained in [draft PR #14](https://github.com/neverbetter420-design/ninth-heart-studios-os/pull/14). The latest artifact is `nhs-nocturne-atelier-visual-review`; it contains synthetic local test records only. Desktop captures are 1280–1440 CSS pixels wide; mobile captures are 390 CSS pixels wide, with higher-density pixels in the image files. The network-blocked source suite additionally checks 320–1440px and long, empty and unavailable states.

Each prefix below has `-desktop.png` and `-mobile.png` variants in the final review artifact.

| Review group | Capture prefixes |
| --- | --- |
| Admin entry | `nocturne-admin-home` |
| Growth | `nocturne-leads`, `nocturne-lead-detail`, `nocturne-scanner`, `nocturne-radar`, `nocturne-opportunity` |
| Relationships and delivery | `nocturne-clients`, `nocturne-client-workspace`, `nocturne-admin-pipeline`, `nocturne-admin-project` |
| Documents | `nocturne-contracts`, `nocturne-contract-workspace`, `nocturne-forms`, `nocturne-form-workspace`, `nocturne-templates`, `nocturne-template-workspace` |
| Studio tools | `nocturne-muse`, `nocturne-automations`, `nocturne-settings` |
| Client Atelier | `atelier-home`, `atelier-projects`, `atelier-workspace`, `atelier-documents`, `atelier-messages`, `atelier-files`, `atelier-approvals`, `atelier-contracts`, `atelier-forms` |

That is 28 views, paired across desktop and mobile: 56 captures. Native development-server indicators, if visible, are test tooling rather than application controls. Automated checks and synthetic screenshots do not substitute for owner visual acceptance, a full accessibility audit or post-deployment verification.

## Identity and release status

The uploaded NHS logo was found and inspected. Header, menu and browser icon now use uniformly scaled versions of that original, with the complete heart, orbit ring and skull key unchanged. Its black background is retained; no transparent version or generated redraw is claimed. See [original logo provenance](NHS_ORIGINAL_LOGO_SOURCE.md). The earlier generated glowing-orbit candidate with a baked-in checkerboard is not used.

Keep PR #14 draft and unmerged. A verified restorable backup and distinct security-migration, merge and deployment approvals remain required. The production preflight's hosted observations are dated October 17 and have not been refreshed during this design pass. No hosted writes, migrations, configuration changes, automation activation or external messages were performed.
