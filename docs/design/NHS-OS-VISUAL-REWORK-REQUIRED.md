# NHS OS · VISUAL FIDELITY REWORK REQUIRED

**Owner review status: REJECTED · November 18, 2026. NOT APPROVED FOR MERGE OR DEPLOYMENT.**

## Source of truth
Approved reference: **Ninth Heart Studios OS Dashboard Collection.png** from the owner's design library. Supporting reference: **Ninth Heart Studios Design Blueprint.png**, as relevant to NHS identity. These images are approval references, **not** outputs from the recent technical preview. The owner explicitly rejected all seven desktop/mobile room previews delivered by the `nhs-at2-owner-gallery` workflow.

### Precise differences in the rejected implementation
1. **Composition**: approved design has immersive, decorative, editorial cinematic scenes with the interface integrated into them. Rejected shots show broad mostly empty headers, cramped tiny utility content below, and generic split/separator rows.
2. **Navigation**: approved rooms feature a premium persistent top-level navigation identity with clear room context, luminous CTA and prominent icon-first room actions. Rejected shots rely on small navigation controls and dense data typography, not the approved action choreography.
3. **Studio Pulse**: approved Command Center emphasizes an immediately visible circular, luminous Pulse meter alongside four meaningful studio summary/action indicators. Rejected screenshot places sparse metrics under a large headline, without the approved Pulse instrument.
4. **Room character**: Command Center skull/key/velvet/crimson; Electric Conservatory cobalt and botanical technology; Rose Salon warmer romantic accents; Artist's Atelier tools/painting and metallic creativity; Private Archive book/key/paper architecture; Velvet Room violet crystal and editorial craft; Client Atelier dramatic butterfly/rose with discreet account controls. Each uses distinct artwork and distinct arrangements, not seven copies of the same linear content template.
5. **Surface**: approved smoke/frosted dark glass has thin bright metallic edges and restrained neon; the last requested treatment is extremely transparent **18–24% tint with 28px blur**, preserving readable controls and keyboard focus. Rejected renders are visually too flat in places and too solid in others.
6. **Typography**: use **Single Ghost for large headers**, **Anger Styles for feature/section titles**, and DM Sans for functional body data/forms. The screenshots use font fallbacks rather than those actual decorative glyphs; do not claim full typographic approval from these screenshots.
7. **Artwork quality**: no zoomed, clipped ornamental framing; keep backdrop stationary while content scrolls, using `contain` and dark side gutters. No repeated art; no image duplicated inside every glass card; don't replace images with black flat pages. Avoid seasonal Halloween/alchemy/potion scenes and avoid repetitive roses.
8. **Unwanted image**: the current `nhs-at2-project-pipeline.webp` prominently features a medical cross, ECG heart and DNA helix, contrary to the owner's explicit instruction to remove the blue medical artwork completely. This is a **hard blocker**. Use the established Artist's Atelier artwork until a true artistic replacement is reviewed.
9. **Mobile**: reconstruct layouts for portrait rather than shrinking text-heavy desktop compositions. Maintain rich room identity, 2-column icon actions where space allows, full imagery, readable buttons, no horizontal overflow or clipped controls.

## Correct build sequence: visually locked, not code-green by itself
1. **Stop**: keep this PR in draft with a visible visual-rejection label; technical CI green is not design acceptance.
2. **Reference-lock the Command Center** against the approved board. Build the correct visual hierarchy (ornamental hero, pulse dial, luminous icon actions, floating crystalline glass). Retain live backend data and existing button behavior. Generate authenticated-free desktop/mobile screenshots from true app components.
3. **Owner sign-off on the actual Command Center screenshots** before generalizing the system to other rooms. Do not treat another generic contact sheet or written promise as an approval.
4. Implement the other six rooms according to their specific artwork and layout, never a uniform card-list template. Keep sign-in secure and the original NHS logo untouched.
5. Confirm screenshots at 1440, 1024, 768, 390 and 320 CSS pixels, visual comparison with approved reference, contrast/keyboard, title font rendering, performance and scrolling. Then independently run technical, Auth/RLS and functional checks.
6. Any merge or staging/production deployment requires explicit separate authorization. Preserve existing real clients, backend, disabled AI/outreach/paid scans and unactivated test identities.

## No progress inflation
- **Green workflow checks** assert build behavior, hash provenance, fixed wallpaper and no overflow. They **do not** assert fidelity to an approved artistic layout.
- The owner-supplied `index.html` is a contact-sheet page that references 14 JPEGs. The screenshots themselves were fetched from the successful GitHub workflow artifact and reviewed against the approved NHS OS reference.
- The screenshot package and reference should be used as a **failed baseline** for redesign, not a design sign-off.
