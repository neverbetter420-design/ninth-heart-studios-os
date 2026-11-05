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

## Color Studio revision (owner-approved visual direction, still draft)

- Reuses the original NHS logo and Command Center's custom rose/key/spark glyphs, now in a colorful illustrated portal orbit. The existing private atelier illustration stays decorative and local.
- Replaces bare type-led portal arrival with a warm personalized welcome, cobalt-to-magenta call to action, and actual project/approval summaries. Unavailable approval data uses a dash, never a fabricated zero.
- Adds a circular progress widget tied to the current project record while retaining the existing accessible linear progressbar and destination.
- Gives the existing interactive Atelier Compass tabs distinct visual icons and colorful states without changing their behavior or project data.
- Makes Messages, Files, Documents and Approvals icon-first actionable destinations. The Rooms popover receives section colors and larger glyph targets without restoring a sidebar.
- Dark navy ink, magenta, cobalt, crimson, violet and silver accents are contrasted against spacious open surfaces; mobile layouts and reduced-motion/forced-colors protections remain.
- Owner approval covers this visual direction only. No hosted preview, merge, deployment, release credentials, hosted data writes, Muse activation, paid services, scans or outreach.

This change requires fresh exact-head CI, particularly source-rendered responsive screenshots, accessibility and authenticated A/B isolation; passing a previous draft's suite does not validate this revision.


## Visible relics revision (approved November 4, source-only)

The owner observed that the earlier color treatment still lacked unmistakable roses, skulls and skeleton keys. This revision adds a dedicated etched-relief SVG component with distinct rose bloom/stem/leaves, silver skull cameo, and ornamented skeleton key. These are **not** replacements for the original logo.

- Hero: three full illustrated relics visibly flank the original logo orbit (large rose upper left, silver skull upper right, blue skeleton key lower right).
- Widgets: rose/key charms decorate the real-data project progress dial; silver skull heads the interactive Atelier Compass, with a rose flourish at its edge. Do not cover actual controls.
- Section rhythm: open floral/relic separators replace otherwise empty breaks, without turning the page into a grid of cards.
- Empty project state: rose/key decorative illustration; no fake project data.
- Every client subroom: a small shared, noninteractive rose/skull/key corner composition. The home hides that shared composition to avoid duplicating its larger hero.
- Decoration is aria-hidden, pointer-events none, responsive down to 320px, no separate branding/logo invention, and no external image sources or paid assets. Test source-rendered SVG presence and bounds, screenshots and accessible routes.
- Do not merge, deploy, publish Cloudflare preview, write to hosted Supabase, enable Muse or paid services, or run outreach/scans. Owner approved this **design amendment** only.


## Distinct background pictures across all seven rooms (Nov 4 design approval)

The owner's Command Center screenshot is the reference for atmospheric continuity,
not for an identical background image copied room to room. The existing Midnight
Observatory hero and original NHS logo are preserved. Six new local standalone
scene illustrations ship under `public/visuals/nhs-wallpaper-*.svg`:

- Electric Conservatory: glowing blue celestial glass globe, rose, skull and key.
- Rose Salon: antique mirror, silver skull cameo, velvet roses and skeleton key.
- Artist's Atelier: richly framed artist's canvas, gallery roses and metal key.
- Private Archive: open manuscript/folio, metallic skull, candlelit rose and key.
- Velvet Room: amethyst crystal sphere, silver skull, roses and ornate key.
- Client Private Atelier: cobalt butterfly, silver skull, lush roses and key.

All seven share dark dramatic room lighting, romantic metallic ornament, generous
visual negative space and a readable black-to-sheer text veil. No added panels,
new UI state, fake data or changes to auth/RLS. Working widgets remain functional.
The client's room remains dark, not cream. New art is background-only and cannot
intercept pointer or keyboard interactions. Standalone SVG illustrations use no
external CDN, font or paid image service. This is a pictorial SVG treatment,
rather than six newly photographed assets; it requires the owner's visual review
before release. The CI visual test asserts separate computed backgrounds across
the seven rooms and saves desktop/mobile screenshots for inspection.

Visual-design approval does not authorize merge, hosted preview, Cloudflare config,
production deployment, live Supabase writes, Muse activation, paid services,
lead scanning or outreach. PR #69 remains draft and source-only.
