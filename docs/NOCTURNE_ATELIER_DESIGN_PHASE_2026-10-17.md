# NHS OS Nocturne: Atelier Edition — Design Implementation

**Owner-approved design phase · October 17, 2026**

**Release mode: DRAFT ONLY.** All edits are on `feature/working-navigation-client-portal`, in draft PR #14. Do not merge, run schema migrations, reset customer accounts, trigger automations, or deploy the Cloudflare Worker without separate production approval and a verified backup.

## Evidence: owner-directed usability review

- Admin Command Center navigation: **5/5 PASS**
- Lead Intelligence & Client Management: **6/6 PASS**, but the layout is too cluttered
- Project Pipeline & Workspace: **7/7 PASS**, but its layout is cluttered
- Client Portal: authorized client access confirmed and usable; too cluttered, navigation needs clearer hierarchy
- Mobile: **6/6 PASS**; preserve working menu, legibility, and responsive controls
- Reported usability defect: Sign Out was not discoverable on the deployed app; existing draft-source sign-out route and sidebar form exist but have low visibility. Treat this as **discoverability / deployed-version verification**, not proof missing server logout implementation.
- Password recovery: owner completed reset; Supabase Auth audit confirmed password update and fresh login for same account.

## Design language

**Admin — Nocturne Command Center:** obsidian, restrained plum/ivory highlights, content-first hierarchy. The Next 3 Actions and Project Pulse are immediately visible. Secondary Muse, Radar and Activity are housed inside an accessible expandable Studio Intelligence panel.

**Client — Atelier:** warm ivory, champagne-adjacent parchment, soft plum, architectural rings, low-contrast gradients, and editorial headings. A welcome hero, one project overview and one next action replace a crowded grid of shortcuts. Three lightweight links make Messages, Files, and Forms discoverable without a wall of cards.

**Creative workspace:** dark professional studio identity with more whitespace, calmer panel framing, and grouped functional destinations. All existing workflows retained.

Never alter the NHS heart/ring/key identity geometry; the glyphs used in this implementation are *abstract decorative UI motifs*, not replacement logos.

## Changes to inspect

- `components/AppShell.tsx`: role-scoped visual theme and always-visible desktop Sign Out action
- `components/Sidebar.tsx`: mobile Sign Out action and retained sidebar/logout form, mobile drawer/active links untouched
- `lib/nav.ts`: client navigation now divided into My workspace, Communication and Decisions & documents
- `app/layout.tsx` + `app/nocturne.css`: visual-system styles loaded last, with distinct admin/client palettes, hover/focus, mobile layouts, reduced-motion support
- `app/(protected)/portal/page.tsx`: calmer client home using RLS-scoped projects and outstanding approval requests, with existing routes and auth checks preserved
- `app/(protected)/portal/projects/[projectId]/page.tsx`: project-destination navigation and native collapsible detail / conversation sections while preserving underlying file, message, form, revision and approval server actions
- `components/Dashboard.tsx`: operational priorities before secondary Studio Intelligence
- `app/(protected)/(admin)/projects/[projectId]/page.tsx`: Tasks, Milestones and Approvals remain visible at the top; revisions, files, messages, documents, launch checks and activity are grouped in native expandable workspace sections with existing actions preserved.
- `scripts/verify-navigation.ts`: source-level regression checks for theme separation, sign-out, client paths and content

## Phase 2 refinement — navigation without clutter

The following source changes are committed on the draft branch and **not deployed**:

- `app/(protected)/portal/documents/page.tsx` introduces a **real client Documents hub**, listing only the project records visible to the authenticated client through existing RLS. Contracts and Forms retain their real, separate destinations under one Documents menu item, reducing client navigation to six first-level links.
- Client Home now opens Documents for paperwork; `lib/nav.ts` retains Home, My Projects, Messages, Files, Approvals and Documents.
- Resource-to-project links use section-aware parameters (e.g., `?section=documents#documents`) so relevant project disclosures open before focusing the target, rather than scrolling into closed content.
- `components/WorkspaceBreadcrumbs.tsx` shows route-aware, role-specific location breadcrumbs with non-sensitive detail labels, including compact breadcrumbs beneath the mobile menu.
- The Admin sidebar provides keyboard-operable, `aria-expanded` collapsible navigation groups, initially focused on the active section. Clients keep their short, always-visible grouped navigation.
- Structural and browser tests now cover document discovery, preserved Contracts/Forms routes, breadcrumb accessibility, and opening collapsed admin groups.

**Acceptance specifics:**
1. Admin current sidebar group opens for the current route; other groups expand by keyboard and mouse. Mobile drawer should not clip long labels, and Sign Out remains visible.
2. Client Documents shows only entitled documents; Client B cannot access Client A's documents or linked project pages. No service-role DB reads were introduced.
3. Clicking a document enters its project with the Documents detail expanded; Messages, Files, Forms and Contracts links open the corresponding expandable resource area.
4. The Documents hub is an index and navigation surface; it does not replace private Storage access controls, sign contracts, or create files.
5. Preserve mobile responsiveness and live client project role isolation. **The revised UI has not received owner-side visual approval or production smoke testing yet.**

## Phase 3 refinement — consistent Atelier collections and visual proof

- `app/(protected)/portal/projects/page.tsx` now presents the project collection as airy editorial rows with per-project progress and clear workspace links, retaining the original project IDs and permission checks.
- `components/portal/PortalResourcePage.tsx` now groups Messages, Files, Approvals, Contracts, and Forms by RLS-visible project using a calmer row layout, retaining working deep links and destinations. No table, row, schema, or action handler changed.
- `app/nocturne-phase3.css` scopes the collection styling to the client role and includes responsive design down to narrow mobile viewports and a reduced-motion preference.
- `tests/e2e/phase3-local-ui.spec.mjs` exercises these collections using **synthetic clients** against **localhost-only disposable Supabase**, and captures full-page screenshots of the Client Home, Projects, and Documents screens on desktop and mobile.
- `.github/workflows/phase3-supabase-local.yml` uploads synthetic previews as a **7-day GitHub Actions artifact** named `nhs-nocturne-atelier-visual-review` only when the isolated local test succeeds. These screenshots are not from production and no customer records or live access tokens are included.

**Review criteria:** verify visual composition, responsive line lengths, action discoverability, contrast, clean navigation, and the fact that the project and resource lists are visibly less cluttered. A passed screenshot-generation job does not substitute for human visual approval of the screenshots.

## Phase 3 follow-through — cohesive client collections and lighter admin forms

- The **Client Projects** route no longer stacks heavy project cards: it presents an editorial project list with clear progress and workspace links.
- The shared **PortalResourcePage** component now groups Messages, Files, Approvals, Contracts and Forms by entitled project, using spacious rows instead of repeating the same boxed presentation.
- Both changes retain the existing user-scoped Supabase queries, deep-link resolution, and client role gate.
- Admin **New Client** and **New Project** forms are native expandable controls. They stay collapsed by default, and are automatically expanded when a creation error is present. Actions/validation unchanged.
- `app/nocturne-phase3.css` contains responsive client collection and admin creation styles, loaded after the existing Nocturne design.
- The isolated-local Playwright visual suite now captures **Admin Home, Admin Project Pipeline, Admin Project Workspace, Client Home, Client Projects and Client Documents**, each for desktop and mobile with **synthetic** credentials and records. Successful job publishes twelve PNG screenshots in the short-lived private GitHub Actions artifact `nhs-nocturne-atelier-visual-review`. These screenshots are visual review inputs, not automatic approval.
- Neither private production Storage objects nor live customer records are exported to the screenshot artifact.

**Review/ship gate:** Owner must inspect the synthetic previews and test revised navigation on a staged app build. Continue withholding the pending security migration, live deployment, and PR merge until the verified backup and distinct production approvals are in place.

## Functional and visual acceptance

1. **Admin desktop/mobile:** sign out accessible from account controls; after sign out, protected routes require reauthentication; sidebar still navigates all admin tools.
2. **Client desktop/mobile:** homepage has a clear primary action; projects, messages, files, approvals, contracts and forms remain reachable without admin tools.
3. **Project drill-down:** pending approval prominently visible, collapsed details can be opened with keyboard and pointer, messages can be expanded; links to dedicated resources work.
4. **Role isolation:** styling cannot serve as authorization; maintain existing server-side RLS and role-scoped routing. Test Client A cannot view Client B projects, files, messages or approvals.
5. **Usability:** never trap focus inside collapsed content; test focus ring, reduced-motion preference, long project titles, empty states, errors, and 320–1440 px viewport widths.
6. **Visual:** no clipped text, unintended horizontal scrolling, overwhelming action grids, or decorated backgrounds obscuring controls.
7. **Release:** verify manual backup (including Auth and Storage object bytes), production security migration, merged commit SHA and tested deployment only after explicit approvals.

**Known scope boundary:** This design pass improves discoverability and hierarchy. It does not yet implement a new documents aggregation route, per-project tab subroutes, a custom logo file, or actual data mutations. Current client details use expandable sections as an interim step; after user visual review, refine sections and typography as needed before production release.

## Verification status

The code is not considered complete until TypeScript, `verify:navigation`, Next.js production build, Cloudflare dry run and browser QA pass on the **final design commit**. GitHub PR checks are the evidence, not a successful save to GitHub alone.

The successful owner-led mobile tests apply to the **previous deployed UI**, not automatically to these new draft-only styles. Re-test the new design before deployment.
