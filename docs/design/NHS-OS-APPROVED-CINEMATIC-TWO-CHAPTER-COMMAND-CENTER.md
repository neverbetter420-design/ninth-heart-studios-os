# NHS OS Command Center · APPROVED CINEMATIC TWO-CHAPTER MOCKUP

**Owner approval:** Explicit “approved” on November 18, 2026, immediately after the two-chapter Command Center mockup was shown.

## Exact visual source of truth

- Conversation image: `a_cinematic_highly_detailed_ui_mockup_of_the_ni.png`
- Raster dimensions: **1199 × 1312 px**, SHA-256: `d8d6ceabdeb8b36f783db5bf57d4444e3391821f60d7d03be54dd54516015c3c`.
- This is a **conceptual composite mockup containing illustrative data and UI**, *not* a background image to put behind functional interface.
- Existing approved mobile chapter-I background: `634f9f81-aaa2-437a-b538-90d899b5f376.png` (942 × 1670; SHA-256 `700e06d16362e15d3a10500acedf5470d2d1011e6883126ec45e816bb3c0866e`).
- Existing paired desktop chapter-I background: `ChatGPT Image Nov 18, 2026, 04_32_45 AM.png` (1672 × 941; SHA-256 `e7e59728a863cf96287109481e04653654aa6d9c5104a4a96b45172be8ee5411`).
- Those original files were provided through conversation; this documentation does **not** establish that the new binaries are installed in GitHub or active in the app.

## Approved structure

### Chapter I: Command Center · Welcome and Studio Pulse
- One luxurious obsidian, silver arch, magenta-left/cobalt-right luminous framed scene, with compact skull/key and small crystals near the top center.
- Brand identity in sidebar/top chrome uses the **original NHS logo**, not a generated replacement.
- Editorial header in **Single Ghost** (licensed embedding check outstanding), short useful subheading and real-user identity only where authorized.
- Circular Studio Pulse with actual project progression / available business data; KPI tiles show **real** values or explicit unavailable states, never stock mockup figures.
- Clear navigation and actions within appropriate touch sizes, translucent 28px-frosted glass with minimal framing.
- Keep decoration at edges. Preserve the border across 1440/1024/768/390/320 breakpoints with `contain` and centered fixed scene, never cropping/tiling/stretching.

### Visual chapter break
- The transition occurs at the *actual boundary of meaningful sections*, not a hard-coded 50% scroll.
- Silver filigree with a single violet-crystal divider, delicate magenta-to-cobalt continuity.
- A calm ~800ms crossfade of fixed viewport background layers as the Chapter II working section becomes visible.
- No abrupt flash, parallax that makes text hard to read, scroll-jacking, or layout shifts.
- Fallback: no animation for `prefers-reduced-motion` and a clear, readable high-contrast scene.

### Chapter II: The Working Atelier
- **Distinct but related** gothic-architectural atmosphere: violet stained-glass / silver arches / magenta-cobalt luminous touches, stronger lower-workroom atmosphere than Chapter I.
- Work panels become a deliberately asymmetric floating-glass composition: real project pipeline and ranked priority focus, followed by genuine activity and any available quick actions.
- **Anger Styles** for feature/section titles; functional body text/forms stay in readable DM Sans.
- All links, project rows, task states, and counts must be connected to existing authorized app state. **Do not create “12 new leads”, “7 active projects”, tasks, a name, or any fictitious sample data from the concept**.
- New Chapter II desktop and mobile **background-only artworks** need separate creation/selection and visual approval. Do **not** crop the composite mockup for wallpaper.

## Existing approval boundaries

1. The visual **direction and layout** are approved. This is not approval to merge PR #80, deploy staging/production, touch real client data, alter Auth/RLS or enable paid/outreach/AI features.
2. Technical implementation and correct background-only asset delivery must be independently reviewed in desktop/mobile screenshots before design signoff.
3. PR #80 remains draft and flagged **VISUAL REWORK REQUIRED** until screenshot parity is demonstrated.
4. This approval applies to the **Command Center** and its two-chapter pattern, not automatically to every other room. Preserve their unique identities.
5. When first wiring the structure, a subtle, coordinated *gradient placeholder* is acceptable for Chapter II while artwork is missing, but **must not be represented as the approved finished second image**.

## Implementation checkpoint · November 18, 2026

Draft PR #80 now includes a further scoped Command Center refinement, without merging or deploying:

- `app/nhs-command-chapters.css` overrides the rejected AT2 Observatory wallpaper in the actual viewport layer. Until the two exact Chapter I owner-approved image binaries can be imported and SHA-verified, it displays the established existing NHS photo as a **temporary fallback**. It is not the approved new background.
- The hero's redundant surrounding frame and heavy full-hero gradient are removed; a translucent, localized text scrim and 28px Studio Pulse glass preserve practical readability without burying the artwork.
- The CSS provides separate desktop and mobile Chapter I image slots, each with fixed center / `contain` / `no-repeat`, plus the existing independent Chapter II image slot and ~800ms section-linked fade. New Chapter II art is **not** installed or accepted.
- `tests/e2e/nhs-command-chapters.spec.mjs` checks the real section boundary, fixed-image containment, borderless stage, absence of horizontal overflow and reduced-motion behavior. `scripts/verify-velvet-atelier-pilot.mjs` now recognizes the approved Chapter I semantic scene marker while preserving its exact anchor check.
- GitHub CI was triggered on the existing draft head; a passing source/TypeScript guard must not be confused with visual acceptance. Authenticated or locally rendered 1440, 1024, 768, 390 and 320px screenshots, real custom-font rendering, browser QA, and owner review remain required.

**Still blocking visual signoff:** exact desktop portrait/landscape art import, independently approved Chapter II background-only art in two aspect ratios, screenshots of the actual responsive app, and full independent test results. No production release authority has been granted.

## Acceptance checklist
- [x] Concept approved by owner
- [x] Exact reference image identified and fingerprinted
- [ ] Both responsive Chapter I background binaries integrated and SHA-verified
- [ ] Separate Chapter II desktop and mobile background-only art approved/integrated
- [ ] Real-data two-chapter app structure + scroll-linked fade tested
- [ ] Desktop/mobile visual screenshots match approved composition
- [ ] Keyboard, high contrast, reduced motion, input focus and no overflow verified
- [ ] Independent Supabase/Auth and application checks pass
- [ ] Explicit separate merge/deployment authorization
