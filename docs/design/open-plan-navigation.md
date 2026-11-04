# NHS open-plan navigation and dark client atelier

The shared AppShell in PR #68 still mounted Sidebar in every protected room.
Its 1,408-line pilot stylesheet only changed the Command Center; multiple
later client selectors deliberately retained cream surfaces. This change is
based on #68 at fd001dac00357d7cf59a527b25e99436407b85db and expands the design
scope to the shared shell and client portal as requested on November 4, 2026.

## Result

- Remove Sidebar from the component tree and delete its implementation. No
  permanent column, sliding side panel or fixed mobile dock remains.
- The header retains the original NHS logo, route breadcrumbs, room identity,
  account controls and the unchanged POST sign-out endpoint. Rooms opens a
  full-width grouped directory. It uses the existing navItems role filter and
  navigationContext so nested routes and Documents children stay aligned.
- Native auto-popover supports keyboard activation, Escape, Close, light
  dismissal and focus restoration before hydration. A route effect closes it
  during navigation, and a skip link reaches the working content.
- The client atelier has an open editorial arrival, ink/violet environment,
  spacious project readout and a dark decision panel. The palette extends to
  collections, resource pages, project collaboration, dialogs and form inputs.
- Authentication, server authorization, RLS, queries, actions, data, uploaded
  assets, original logo bytes and all route definitions are unchanged.

## Validation

`npm run typecheck`, `npm run build -- --webpack`, `npm run verify:navigation`,
`npm run verify:soft-welcome`, `node scripts/verify-velvet-atelier-pilot.mjs`,
`node scripts/build-nocturne-static.mjs`, and
`node scripts/verify-nocturne-static.mjs` passed locally.

`playwright.open-plan.config.mjs` verifies 15 actual source-rendered views at
1440, 1024, 768, 430, 390 and 320px, no sidebar/dock or horizontal overflow,
closed/open role directories, nested active routes, dark client surfaces,
empty/error/long data, keyboard dismissal/focus, reduced motion and forced
colors. Axe WCAG A/AA checks cover nine client views and both directories at
1440 and 390px. Screenshots contain synthetic data and source CSS with system
font fallbacks, not authenticated live sessions. They are review evidence,
not proof that production has changed or owner visual acceptance.

The existing disposable Supabase Auth/API and authenticated browser tests are
retained, with selectors changed to use the Rooms directory on both desktop
and mobile. These cover real logins, client A/B project isolation, tampered
message IDs, private documents, decisions and file workflows. Local Docker
is unavailable, so their result must be checked on the new PR's exact CI head.

## Release boundary

Draft only. No merge, production deployment, hosted preview publication,
Cloudflare configuration change, hosted database write, Muse activation,
paid service, lead scan or outreach. Existing CI uses temporary synthetic
databases and build/dry-run checks. Production and previews remain untouched.
