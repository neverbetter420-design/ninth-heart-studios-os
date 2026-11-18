# NHS OS · AT2 visual handoff RETIRED · owner rejection November 18, 2026

**Status:** Owner rejected all seven room screenshots as not matching the approved NHS OS Dashboard Collection. PR #80 remains draft; neither these scene selections nor their screenshots are visually approved. No merge, staging or production deployment.

The original one-ZIP package and one-time importer are retired. The earlier package was claimed to contain no medical imagery, but source inspection confirmed `nhs-at2-project-pipeline.webp` contained a medical cross, ECG heart and DNA helix. This file is being deleted from the repository and cannot be reimported via the retired workflow. **Do not reuse the old ZIP.**

## Retained image assets, all visually unapproved
- `nhs-at2-mobile-welcome.webp` (mobile sign-in)
- `nhs-at2-command-center.webp` (Admin Observatory)
- `nhs-at2-muse-chamber.webp` (Muse Studio)
- `nhs-at2-client-sanctuary.webp` (Client Sanctuary home)
- `nhs-at2-brand-welcome.webp` (desktop sign-in)
- `nhs-at2-admin-entrance.webp` (unactivated alternate)
- `nhs-at2-workspace-floral.webp` (Lead Intelligence)

The Project Pipeline returns to the previously available `nhs-scene-artist.webp` artwork until an actually artistic, non-medical replacement matches the approved Painter's Atelier design. The current seven-image manifest `docs/design/nhs-at2-assets.json` records exact SHA-256 hashes.

## Mandatory art/design direction
- Approved main visual reference: **Ninth Heart Studios OS Dashboard Collection.png**.
- Full, rich, dramatic NHS room compositions, with metallic skull/key/heart, selectively floral, cobalt, magenta, crimson and silver accents, and distinct artistic identity for each of seven rooms.
- Layout should have clearly integrated glass instrument panels, large Studio Pulse instrument and meaningful icon-first actions, not the same generic text/statistic layout repeated over seven pages.
- Owner explicitly wants stationary full-scene artwork, no cutting off ornamental edges: center and `contain`, never `cover` and never repeated wallpaper.
- Extremely transparent tinted glass with ~28px blur, readable high-contrast type, deliberate asymmetric bento composition, small readable paragraphs and detailed responsive mobile.
- Single Ghost for main headers, Anger Styles for title treatments, DM Sans for functional controls. Current automated tests use fallback fonts and cannot visually sign off actual glyphs.
- Maintain original NHS logo, app behavior and client privacy. No added paid services, outreach, Supabase/Auth/RLS changes or production deploy.

See **`docs/design/NHS-OS-VISUAL-REWORK-REQUIRED.md`** for the signed-off target-vs-rejected screenshots breakdown and per-room acceptance gates.

## Current release gate
- [x] Owner rejection recorded unambiguously
- [x] Approved board retrieved and compared to actual fourteen screenshots
- [x] Medical scene no longer selected by the Artist room
- [ ] Golden reference Command Center redesign matches approved board at desktop and mobile
- [ ] Six other distinct, compositionally faithful rooms reviewed
- [ ] Actual custom font rendering/embedding authorization resolved
- [ ] Real component screenshots accepted by the owner
- [ ] Technical, functional, responsive and security CI rerun after redesign
- [ ] Explicit deployment authorization. NOT GRANTED.
