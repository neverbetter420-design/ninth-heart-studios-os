# NHS OS · Command Center responsive background art direction

**Decision recorded:** November 18, 2026
**Scope:** NHS OS Admin Observatory / Command Center only
**Mobile art decision:** OWNER SELECTED AND LOCKED
**Desktop companion:** NOT YET CREATED OR APPROVED
**Implementation/deployment:** NOT ACTIVATED. Draft-only decision record; PR #80 is still VISUAL REWORK REQUIRED / DO NOT MERGE.

## Mobile: selected visual (user upload in Nov 18 conversation)

Reference: **The last owner-uploaded portrait image**, featuring:

- Glossy, delicate, bronze/silver metallic arched framework and full ornamental edge border, with magenta glow on left and electric cobalt on right.
- A *small* skull-and-skeleton-key ornament at top center suspended between decorative chains and tiny violet crystals; its compact proportions are important. **Do not enlarge the key or obscure the page heading with it.**
- One vivid crimson/magenta rose at upper-left edge, and a blue-magenta rose at lower-right edge; restrained silver foliage and small violet crystal droplets at edges.
- An intentionally very dark, open central area for actual app data. No extra image-rendered text, fabricated NHS logo, or dashboard widgets.
- A dark reflective bottom edge. Keep **all four decorative borders visible**; do not zoom, crop, tile, or stretch.
- Art is an *ornamental backdrop*, not a substitute for the application's preserved original NHS heart/skull/key logo.

This portrait reference was selected *after* earlier first-pass images were rejected. **This choice supersedes earlier mobile Command Center artwork candidates only.** It does not grant approval to the current dashboard's UI composition or to any other room.

## Desktop: create a real companion composition, not a resized portrait

**Target image size: 2560 × 1440 px (16:9)**. Treat it as a *new landscape composition* with the exact same visual DNA and lighting: matching metallic arch and decorative corner frame, small top-centered skull/key, chains/crystals, magenta left column, cobalt right column, and restrained two-corner rose placement.

- Stretch the **arches horizontally by redesigning them**, not by stretching the mobile pixels.
- Keep the upper key/sculpture **small**, near the top center, without colliding with top navigation.
- Preserve generous, very dark empty areas **inside the arch** for the editorial headline at left, a circular Studio Pulse on the right, and an icon-first shortcut band below.
- Shift roses and crystal accents toward the **outer edges/corners**, not behind text or the dial. Maintain edge details fully visible.
- Match the portrait's materials, color values, reflections, sculptural detail and atmosphere. Do not make a separate unrelated abstract ribbon scene for desktop.
- No typographic content burned into the artwork; the app provides real Single Ghost/Anger Styles headings and the preserved original NHS logo.
- No medical/DNA/ECG imagery, no alchemy/Halloween props, no excess rose repetition.

**Optional tablet companion**: 1536 × 2048 px; only needed if the desktop/mobile assets do not frame a tablet well. Prioritize desktop + mobile first.

## Implementation acceptance after both visual assets are approved

1. Add the *exact* approved mobile and desktop binaries to the **draft** source with SHA-256 verification. Do not add/reimport unapproved earlier ZIPs.
2. Use responsive CSS/background art direction: portrait mobile, landscape desktop, centered positioning, contain sizing, no tiling, and stationary viewport artwork behind scrolling content. Dark-color letterboxing is acceptable to preserve the border.
3. Allow the ~28px very transparent frosted-glass panels, Studio Pulse and icon-first navigation to float **over the central negative space**, without a second framed hero or nested opaque cards.
4. Inspect actual 1440/1024/768/390/320 viewport screenshots for all edges, ornament clearance, readability, data/control visibility, focus/tap behavior, overflow and title font correctness.
5. Get **separate owner approval of desktop and mobile app screenshots** before implementation is treated as complete.
6. Do not deploy, merge PR #80, change Supabase/Auth/RLS or client records, or enable paid/automated workflows without explicit authorization.

**Implementation reminder:** This is a source-of-truth design decision, not a claim that the uploaded portrait image is already tracked by GitHub or displayed in the real app.
