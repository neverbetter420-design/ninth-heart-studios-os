# NHS Nocturne · The Velvet Atelier
## Approved design contract / Admin Command Center pilot

**Status:** source-only visual pilot, awaiting owner screenshot and interaction approval. **Not a production design approval or deployment.**

### What stays
- Preserve the original NHS heart / chrome skull / skeleton-key logo asset at `public/brand/nhs-original-logo.webp`. Do not redraw it.
- Keep the existing Midnight Observatory photographic skull-and-rose artwork, room identities, navigation destinations, responsive shell, live Supabase data, role checks, and interactive Priority Halo.
- Preserve Nocturne's dark atmosphere and its luxury / welcoming editorial voice.
- No production or staging deployment without separate approval. PR #67's tested staging-auth release candidate remains unchanged.
- Muse AI, Muse Project Guide, paid services, scans, outreach, live DB migrations remain OFF.

### Approved visual direction
- Near-black and graphite form almost all of the visual field. The exact original NHS brand definitions remain in `app/globals.css`: void `#030309`, silver `#F4EEF6`, rose `#D32C5A`, magenta `#B92BE1`, violet `#4A158C`, cobalt `#3221E4`.
- Use accessible, low-saturation **interface reflections** of magenta, cobalt and violet in icon strokes, focus, active states, fine rules and small glows. No giant neon panels; no harsh cream on the Command Center.
- Smoked glass should highlight one main working surface, not become a cage of identical rectangular cards.
- Carry small skull, rose and ornate-key decorative symbols across the room. These are UI ornaments, not replacement logo/mascot artwork. Decorative icons have no click handlers.
- Keep prominent icon-first functional navigation for Leads, Projects, Clients, Opportunities.
- Give information an editorial hierarchy: a generous welcome, a mixed treatment of three metrics, an accessible shortcut rail, one interactive Priority Halo panel, an open Project Pulse rail, activity, then the existing native `<details>` disclosure.
- Maintain 44px-ish action targets, accessible keyboard focus, contrast, responsive single-column and reduced-motion behavior.

### Pilot implementation notes
- Scoped opt-in root class: `.nocturne-command-center.velvet-atelier-pilot`.
- Late-loaded CSS: `app/velvet-atelier-admin-pilot.css`. This deliberately wins over legacy Nocturne / Soft Atelier CSS **only** inside the admin Command Center.
- Original photo and dynamic datasets remain in their existing components.
- New decorative SVG symbols: `components/AtelierSymbol.tsx` (skull / rose / key / spark).
- Source guard: `scripts/verify-velvet-atelier-pilot.mjs`.

### Visual acceptance checklist (requires actual screenshot / owner's review)
1. On a normal desktop and a narrow laptop, the hero still shows original NHS skull-and-rose art and readable welcome text.
2. On phone widths (375px and 430px), every link, Priority Halo node and disclosure is reachable with no horizontal overflow.
3. Shortcut icons are legible but delicate; dark surfaces dominate. No new cream backgrounds.
4. A keyboard-only pass visibly focuses every link/button and opens the Insights disclosure.
5. With reduced-motion enabled, any animated halo or shortcut motion is suppressed.
6. Existing admin queries and actions still work with staging-only synthetic records. The empty state is welcoming, not a broken blank panel.
7. The client portal and the other six rooms are **out of scope** and should not visually change.

### Later milestones, not authorized by this pilot
- After owner approval of the Command Center pilot: reusable design tokens, per-room visual guidelines, then independent reviews of Clients, Leads, Projects, Workspace, Automations and dark-accessible Client Portal.
- Staging Client A/B identity fixtures and isolation tests are separate functional acceptance work.
