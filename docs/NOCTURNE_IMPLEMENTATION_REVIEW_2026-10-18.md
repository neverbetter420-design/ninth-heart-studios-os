# Nocturne: Atelier Edition implementation review

October 18, 2026. Review branch: `design/nocturne-atelier-implementation-20261018`.
This builds on draft PR #14 and PR #15 at `019e83b0839e9553e2b2f6ab5facd014a1ca2107`.
The follow-up PR targets PR #15's design branch so its implementation diff can be reviewed separately. None of these changes is live.

## Implemented in this pass

- The approved floral arch replaces the earlier silk illustration in both welcome compositions. The shared plum/ivory background remains consistent across destinations, with a stronger veil behind working areas and reduced decoration on phones.
- Admin and client shells specify dark/light native control palettes. High-contrast and forced-color preferences remove the decorative backgrounds.
- Project message senders use readable role-specific colors. Feedback canvas outlines, selected pins and resolved pins remain legible on ivory and plum.
- Client invoice line items use a responsive grid, with a full-width description and usable quantity, price and remove controls on small screens. Inputs have explicit accessible names. Existing calculations, state updates, hidden submitted JSON and action handlers are preserved.
- Asset and fixture changes now trigger the browser workflow and the existing disposable local Supabase workflow. Production deployment remains manual and gated.

The original NHS logo and icon, navigation routes, auth, Supabase queries/policies, migrations, server actions, automation behavior and production Worker configuration are unchanged from the PR #15 baseline. No dependency versions or lockfile entries changed.

## Review the implementation

After installing the project's locked packages:

```powershell
npm run build
$env:NHS_VISUAL_BUILT_CSS = '1'
npm run preview:design
```

Open [the local design review](http://127.0.0.1:4173). Choose the admin/client role, screen, viewport and synthetic scenario. The 28 application destinations are available, along with isolated communication/form controls.

The preview binds only to `127.0.0.1`; it rejects mutations, disables submissions, blocks scripts and external requests, and rewrites app links to synthetic review destinations. It is **source-rendered visual evidence**, without hydration, sign-in, real server actions or live data. Use the toolbar to navigate on mobile. The default uses explicit system fallback fonts; `NHS_VISUAL_BUILT_CSS=1` requires a completed build and embeds that build's processed CSS and exact self-hosted fonts, in manifest order.

The offline browser suite can run without starting Next.js or connecting to Supabase:

```powershell
# Install the same temporary runner used by the repository's browser CI.
npm install --no-save --package-lock=false @playwright/test@1.56.1
npx playwright install chromium
npm run test:visual
# Optionally repeat against production CSS after npm run build:
$env:NHS_VISUAL_BUILT_CSS = '1'
npm run test:visual
```

The suite checks 320–1440px layouts, normal/long/empty/error states, readable sender/pin colors, narrow invoice controls, decoded offline artwork, preserved original-logo loading, high-contrast and forced-color fallbacks. Its destination pass captures 28 screens on desktop and mobile: 56 screenshots. Separate workspace-control and welcome captures provide additional detail. The PR's CI artifacts provide shareable screenshots; a local loopback URL is available only on the computer running this preview.

## Validation and limits

Local typecheck, the Next.js production build, six release-source checks, seven Phase 3 source checks, navigation/form/delivery checks and 88 isolated server-action outcomes passed. Full source-rendered browser results and final-head CI status are recorded in the follow-up PR.

Source-rendered tests do not establish authenticated authorization or hosted delivery. The existing disposable local Supabase workflow performs real synthetic Auth/API and hydrated desktop/mobile walkthroughs; its result must be checked on the final review commit. No hosted write QA, email send, migration or automation run is part of this implementation.

An inherited build-tool dependency advisory remains a release review item: [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) affects the `glob` CLI's command option in the pinned OpenNext dependency chain. The inspected dependency uses the library API; no affected CLI invocation was identified. This is not a blanket security clearance. Review remediation/risk separately and validate the Cloudflare build/dry run before release; no automatic dependency downgrade was performed.

## Next approval gate

Review the desktop/mobile screens and approve this implementation's visual result. That approval does not authorize a production merge, migration or deployment.

Before a release, complete the [production preflight](PRODUCTION_RELEASE_PREFLIGHT_2026-10-17.md) and [email/backup acceptance gates](EMAIL_AND_FREE_PLAN_RELEASE_GATE_2026-10-17.md):

1. Verify a restorable encrypted database/Auth/migration-history backup and separately preserved Storage bytes; finish email delivery, recovery and environment/security prerequisites.
2. Obtain separate authorization for the pending security migration and verify its policy/trigger results.
3. Review exact-head CI and obtain explicit merge approval for the reviewed PR stack.
4. Obtain separate production Worker deployment approval for the reviewed main SHA, then perform the post-release admin/client, permission, file and email checks.

The [staging readiness guide](NOCTURNE_STAGING_READINESS_2026-10-18.md) still governs any hosted preview. This local review creates no hosted Worker/database and does not clear those prerequisites. Provider observations in the older release documents have not been refreshed here.
