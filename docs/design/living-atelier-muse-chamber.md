# NHS OS · The Living Atelier | Muse Velvet Chamber

**Stage:** Source-only visual pilot on a separate draft branch, stacked on
Client Sanctuary PR #78 and Observatory PR #77. **No deployment.**

## Visual direction

The approved Living Atelier system is futuristic, dark, immersive and
recognizably NHS: rose/key/skull symbolism, floating sculptural glass,
liquid-silver edges and restrained cobalt, violet and magenta lighting.
The Muse room should feel like an intimate intelligence studio, not
a dense AI chat dashboard.

This pilot adds:
- A compact, keyboard-focusable, section-aware **Muse destinations**
  dock using the original labels (Studio focus, Write a draft, Saved drafts).
  All three links use native hash navigation before hydration.
- A single enlarged decision surface for the real top recommendation.
- Open, two-column analytic lanes showing existing rankings and project
  risks, with meaningful status chips and readable list rows.
- One luminous glass writing instrument rather than nested form cards.
- Calm, expandable saved-draft rows and responsive narrow-screen layouts.
- Reduced-motion, reduced-transparency and forced-colors accommodations.

The original NHS logo and existing velvet-room artwork
(`/visuals/nhs-scene-velvet.webp`) remain unchanged. The user-approved
Image #18 artwork for a future Muse introduction is **not yet integrated
as a source-verified repository asset**; do not substitute an image query,
generated replica or other artwork to suggest that it is.

## Functionality stays as-is

- The existing `/muse` server page still calls `requireAdmin()`,
  reads permitted project, lead, opportunity and draft data, and computes
  recommendations using existing deterministic logic.
- `MuseRoomDock` is a purely presentational client component. It
  observes section visibility and updates `aria-current="location"`.
  It does **not** fetch, save, generate text, enable a feature flag or
  call an AI endpoint.
- Existing draft actions are untouched. Email sends still require
  the explicit recipient and **Confirm send** per draft.
- `MuseConcierge` remains disabled by default; no activation of
  `MUSE_AI_ENABLED`, `MUSE_PROJECT_GUIDE_ENABLED`, paid APIs or outreach.
- No client route, user identity, Supabase Auth/Storage/RLS rule,
  database migration or Worker deployment changes.

## Acceptance gates

- [ ] Source contract: current anchors, role check, original deterministic
      data flows and manual-send controls remain present
- [ ] Next.js build and TypeScript pass with existing disabled flags
- [ ] Offline Muse screenshots reviewed at 1440, 1024, 740, 390 and 320px;
      no overflow, controls remain visible, artwork is not doubled
- [ ] Keyboard: each dock link focuses and scrolls to the real heading;
      reduced-motion and forced-colors remain usable
- [ ] Priority errors, missing data, long titles, empty drafts and saved
      drafts are all legible
- [ ] Independent browser navigation and local Auth/REST suites pass
- [ ] User signs off on appearance before any merge/deployment

**Release gate:** This is a third stacked **draft PR**, not an approval
to merge or publish anything. Existing staging Storage permission gate
remains separate and unresolved.
