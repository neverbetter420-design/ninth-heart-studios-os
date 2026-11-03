# NHS Nocturne · The Velvet Atelier
## Approved design contract / Admin Command Center pilot

**Status:** Unframed Edition, revision 2 after owner rejected the first pilot as too boxy. The isolated design branch remains draft; hosted screenshot/interaction approval is still required. **Not a production design approval.**

### What stays
- Preserve the original NHS heart / chrome skull / skeleton-key logo asset at `public/brand/nhs-original-logo.webp`. Do not redraw it.
- Keep the existing Midnight Observatory photographic skull-and-rose artwork, room identities, navigation destinations, responsive shell, live Supabase data, role checks, and interactive Priority Halo.
- Preserve Nocturne's dark atmosphere and its luxury / welcoming editorial voice.
- No production or staging deployment without separate approval. PR #67's tested staging-auth release candidate remains unchanged.
- Muse AI, Muse Project Guide, paid services, scans, outreach, live DB migrations remain OFF.

### Approved visual direction
- Near-black and graphite form almost all of the visual field. The exact original NHS brand definitions remain in `app/globals.css`: void `#030309`, silver `#F4EEF6`, rose `#D32C5A`, magenta `#B92BE1`, violet `#4A158C`, cobalt `#3221E4`.
- Use accessible, low-saturation **interface reflections** of magenta, cobalt and violet in icon strokes, focus, active states, fine rules and small glows. No giant neon panels; no harsh cream on the Command Center.
- Keep the Midnight Observatory's dark environmental photography but **remove the large rectangular Action and Metric frames**. Use free-standing editorial typography, open priorities, fine rules and a floating constellation. Save smoked-glass framing for genuinely interactive controls that need it.
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

### Unframed revision acceptance criteria
- The Command Center sidebar has no enclosing outer card or heavy rounded frame on desktop; the active navigation shows a thin magenta line rather than a large fill.
- The entire Next 3 Actions region has no rectangular outline, dark fill or drop shadow. It remains a usable interactive Priority Halo when data exists.
- Empty staging data displays a decorative orbital skull, rose, key and spark alongside the true Capture a lead link. Decoration cannot take focus or intercept clicks.
- Metrics are open, separated by hairlines, not three floating boxes. Projects remain an unframed editorial rail.
- The room should feel connected and expansive at 1440px, 1024px, 430px and 375px: no overflow and no card wall.
- This visual rejection supersedes first-pass layout approval, not the established dark NHS brand aesthetic or staging-auth approval.

### Later milestones, not authorized by this pilot
- After owner approval of the Command Center pilot: reusable design tokens, per-room visual guidelines, then independent reviews of Clients, Leads, Projects, Workspace, Automations and dark-accessible Client Portal.
- Staging Client A/B identity fixtures and isolation tests are separate functional acceptance work.
