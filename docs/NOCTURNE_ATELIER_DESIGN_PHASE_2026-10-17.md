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
- `scripts/verify-navigation.ts`: source-level regression checks for theme separation, sign-out, client paths and content

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
