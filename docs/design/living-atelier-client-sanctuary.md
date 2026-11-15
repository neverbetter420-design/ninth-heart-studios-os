# NHS OS | The Living Atelier · Client Sanctuary pilot

**Design stage:** approved Living Atelier direction, new Client Sanctuary visual
increment, **draft and undeployed**. Built on the already verified Observatory
branch/PR #77. No release, merge or hosted client data acceptance is implied.

## Source and visual decisions

- **Exact owner-uploaded asset:** `public/visuals/nhs-living-atelier-client-sanctuary.webp`
  (1672 × 941, 151,750 bytes, SHA-256
  `b0b259d26af5ac7d8ff07dbdc1c65fb5b517ad6856b8f9ec74ff1d10182ed9d6`).
  Preserve the original NHS logo and existing artwork components.
- **A quieter, futuristic home:** cobalt/metallic silver with restrained
  magenta lighting. The approved blue rose remains visible on the left;
  the welcome text is positioned in the darker right area on desktop.
  Mobile displays the original rose atmosphere behind a stronger veil
  and stacks the existing original-logo medallion and copy.
- **Floating glass:** asymmetrical transparent project progress and
  interactive Atelier Compass islands, with softly illuminated project
  actions, dark translucent micro-status pills, and compact resource
  shortcuts. Avoid putting the wallpaper on every card.
- **All interactions remain real:** Next/Journey/Connect retains its
  existing React state, aria-pressed values, accessible project progress,
  and original project/approval/message routes. No fabricated metrics.
- **Home-only presentation:** overrides require `nhs-theme-client`
  **and** `.atelier-home.nhs-color-studio`. The rest of the portal,
  document pages and admin rooms retain their current themes.

## Privacy and trust boundary

**Server authorization and SQL are untouched.** The existing portal
home still calls `requireUser()`, redirects non-clients, reads
project/approval rows via the current user's Supabase session, and
preserves existing loading/error/empty states. No new session APIs,
cross-client queries, storage URLs, service-role usage, mutations,
feature flags or automation tools have been added.

The CSS references only the local approved static WebP. Its visual
presence in a screenshot is not proof of cross-tenant isolation;
the existing local Supabase Auth/API security workflow remains an
independent regression gate. Do not use real client data for
screenshots or hosted acceptance without separately authorized
test identities.

## Accessibility and rendering checkpoints

- [ ] Owner desktop review: readable welcome copy; left rose intact;
      no doubled artwork or oversized duplicate logo
- [ ] Owner mobile review: no clipping or horizontal overflow;
      44px controls; calm composition at 320, 375 and 430px widths
- [ ] All project, messaging, files, documents, and approval links work
- [ ] Interactive compass changes panels using keyboard and touch
- [ ] Reduced-motion and reduced-transparency fallbacks remain readable
- [ ] High-contrast/forced-color users see solid readable surfaces
- [ ] Empty, error and long project names remain legible
- [ ] Source, typecheck, Next build, browser gallery, and Auth security CI
      pass for the **exact PR head**, not an earlier revision

## Release boundary

Keep this client-facing increment on a **separate draft PR** based on
the Observatory draft branch. Do **not** merge, deploy, change Cloudflare
Workers, production/staging data, Storage RLS grants, Auth identities,
Muse flags, paid integrations, scans or outreach. The separate
staging Storage authorization blocker remains unresolved.
