# NHS OS | The Living Atelier · Observatory Pulse pilot

**Approved direction:** futuristic dark luxury, liquid chrome, sculptural
floating glass, cobalt/magenta/violet lighting, generous negative space,
accessible interactions, minimal but meaningful copy, and original NHS
rose/key/skull artwork. The owner's approved high-fidelity screens are the
visual target. This is the **first functional increment**, not the complete
room redesign or a claim that the approved background images have been
imported.

## Implemented on this draft branch

- An accessible floating **Ninth Pulse** dock in the existing Admin
  Command Center with anchor navigation to Overview, Priorities, Projects
  and Activity. The fifth shortcut opens the real Lead quick-capture route.
- Current-section feedback follows visible section headings via
  `IntersectionObserver`, with clickable anchors working even before
  hydration. There is no synthetic data, server action or artificial AI
  state in the dock.
- Scoped layered smoked glass, silver edges and gentle cobalt/magenta
  highlights. The dock remains in layout flow and sticks near the top
  on wider screens; on phones it becomes a compact horizontal control.
- Native keyboard/focus affordances and short accessible action labels,
  with reduced-motion, high-contrast and reduced-transparency fallbacks.
- Preserve the existing room orbit, live priority Halo, real project
  progress, activity states, existing original logo and photographic
  artwork. No new images were generated or substituted.

## Background placement, when exact approved uploads are available

The uploaded NHS Image 01 (magenta roses and silver currents) is the
approved Command Center atmosphere. Preserve its original crop and
details, focusing artwork away from live content. Keep a dark scrim on
the central reading area, not a flat replacement background. The
original logo remains at `/brand/nhs-original-logo.webp`.

**Do not** treat an image description, thumbnail, approximate online
image, or generated replacement as the actual background asset. Exact
uploaded image bytes must be reviewed and intentionally added to the
repository before wiring that image into the CSS. The existing
photographic artwork remains until that separate asset-integration step.

## Deferred design milestones

1. Review the actual desktop and phone renders of the Observatory
   against the approved concept; refine layout and polish without
   altering underlying queries or functions.
2. **Client Sanctuary:** apply Image 05 with calmer cobalt treatment,
   client-specific privacy/legibility checks, simpler controls.
3. Muse room: build a disabled-by-default interactive shell without
   activating Muse, scans, external writes, or paid integrations.
4. Introduce the full shared Living Atelier visual tokens and approved
   image mapping only after all three signature screens pass review.

## Release boundary

**Source-only, draft PR stacked on the design PR #70.** Do not merge,
deploy, publish a Worker, alter Supabase Storage/Auth/ACL grants or
migrations, turn on Muse or automated outreach/scans, provision accounts,
or enable paid resources. The separate staging permission freeze and
Storage blocker remain independent and unresolved. No hosted client
acceptance is claimed.

## Visual acceptance checklist

- [ ] Desktop: floating dock reads as a single light architectural
      component, not five competing cards.
- [ ] Phone: no horizontal overflow, 44px tap targets, readable names
      and native scrolling to the correct sections.
- [ ] Keyboard: each anchor is reachable and focus-visible, accurate
      destination labels, no focus trap.
- [ ] Motion: active-section feedback works; reduced motion removes
      animated pulse and hover displacement.
- [ ] Existing NHS art: exact source images preserved with legible
      overlays and no logo duplication.
- [ ] Data and safety: unavailable/loading/empty states remain
      distinguishable; no AI activation or new backend reads/writes.
