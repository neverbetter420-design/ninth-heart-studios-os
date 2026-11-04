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

### Approved direction · Living Dashboard draft implementation (revision 3)
- Owner approved the **direction** of a circular, icon-first command hub with concise copy, floating data/status readouts, project progress, original NHS identity, and dark unframed atmosphere. This is approval to implement and test on the **draft branch only**, not final screenshot acceptance.
- `components/LivingStudioHub.tsx` is a presentation component. All route labels and metrics come from the authenticated `Dashboard` server component. The average progress is computed from up to four already-fetched recent projects, and is explicitly labeled a recent-project average. The project metric reads **Total Projects** because the existing exact count includes all pipeline phases (including on hold); a count error shows **Data unavailable**, not a false zero. No fake live counters or new data reads.
- The center displays the existing original `nhs-original-logo.webp`; ring and flourishes are decorative. Four real links remain keyboard-accessible and labelled. The functional Priority Halo, project rows, activity, and native Insights disclosure are unchanged.
- The new CSS is appended to the existing late-loaded, opt-in Admin pilot stylesheet. Old shortcut/metric rules can be removed **after** acceptance rather than risking unrelated pages now.
- Source-only CI checks new component and existing privacy guards. A protected authenticated 1440px, 1024px, 430px, 375px visual/keyboard review is still required; no preview refresh, merge, or release without separate authorization.

### Preview isolation preparation, source-only
- Added `wrangler.velvet-atelier-admin-preview.jsonc` for an independent pilot Worker name (`nhs-os-velvet-atelier-preview`), intentionally **not** the production Worker or original staging Worker.
- The only configuration difference from the existing staging preview's runtime variables is `NHS_APP_URL`, now deliberately set to `https://example.invalid` so the wrong Worker URL can never be used as a callback. This is a **non-operational, source-only preview config** and must not be published as-is. The staging Supabase *publishable* connection is retained without introducing privileged credentials. Both Muse flags remain `false`.
- The config has `workers_dev=false`, `routes=[]`, `preview_urls=true`, `keep_vars=false` and no AI, database-admin, queue, paid integration or deployment authorization bindings. The existing production and prior staging Wrangler configs are unchanged.
- `scripts/verify-velvet-atelier-pilot.mjs` checks these restrictions in CI. This commit does **not** publish the new design, change Cloudflare Access, test password-reset callbacks, deploy anything or enable automatic builds.
- Read-only Cloudflare account inventory on November 2, 2026: `ninth-heart-studios-os` exists; `nhs-os-velvet-atelier-preview` does not yet exist. The account has an Access application `All preview URLs` targeting `all_preview_workers` with a Cloudflare-account-members allow policy; this verifies an access control configuration, **not** the future Worker URL or a tested authentication flow.
- Cloudflare’s preview alias names include the Worker script name. The old `https://design-velvet-atelier-admin-pilot-202611-ninth-heart-studios-os.neverbetter420.workers.dev` belongs to the existing `ninth-heart-studios-os` preview namespace and must not be used as the callback hostname for the separate `nhs-os-velvet-atelier-preview` Worker.
- **Release gate:** after separate authorization to prepare/publish a protected preview, establish its actual assigned URL, confirm the Access redirect and identity policy protect that exact URL, set `NHS_APP_URL` to that verified hostname in both `vars` and `previews.vars`, revalidate allowed OAuth/password-reset redirect origins and exact commit, then rerun CI. Do not publish or change the staging/production Worker under this PR.

### Data fidelity, source-only QA
- Lead and recent-project Supabase read errors now display **Data unavailable** rather than treating failed reads as empty pipelines. This covers the Active Leads / Waiting on Me metrics, the Next 3 Actions empty state, recent-project average/progress, Project Pulse, and lead-derived Muse suggestions.
- Genuine empty results still show the original welcoming empty states. The same five existing read queries remain, with no new requests, mutations, backend changes, feature activation, or production impact. Synthetic Playwright explicitly tests failed-read states, including independent Opportunity Radar and activity-feed read failures.

### Metric language precision
- The Active Leads detail counts lead records whose **next action** is `reply`, so it is labeled **replies needed**, not **human replies** (which incorrectly suggests received inbound messages). The count, ranking, permissions and backing query are unchanged; synthetic browser QA checks the populated example.

### Living Dashboard design revision 4 · Velvet Observatory stage
- In response to the concern that no actual design changed, the Command Center **layout itself** now changes on the draft branch: the previously tight three-column command map becomes a spacious asymmetric stage. At desktop/narrow-laptop widths, a significantly larger original-logo orbital navigation sits left, while the oversized editorial headline and floating real-data status rail sit on the right, separated by substantial breathing room. At phone widths, the stage becomes a deliberately spaced single-column composition with delicate metric dividers.
- The hero photography, NHS original logo, real routes, interactive Priority Halo, project rows, dark visual palette and client isolation stay unchanged. No new page-wide color wash, artificial metrics, fake navigation or feature activation.
- Offline headless Chromium screenshots checked 1440, 1320, 1024, 960, 760, 430, 390, 375 and 320px without horizontal overflow. Source browser QA adds a desktop geometry assertion so a return to the old layout cannot pass unnoticed.
- **This is a draft-only visual change, not a live app update**. Live/published review still requires separately authorized protected preview publication and owner's authenticated visual approval.

### Project Pulse editorial journey · draft revision 5
- Converted the Command Center's simple project list into a responsive **numbered, unframed project journey** with clearer project-title links, real pipeline phase, due-date labels, due-soon/overdue emphasis and accessible, named progress bars. No fake records or new reads.
- Progress is display-normalized with the existing `displayProgress` helper. Date labels and Pacific-time due status reuse the existing `formatProjectDate` and `projectDueState` helpers; no stored values change.
- The design remains dark and deliberately low-chrome, preserving all original project navigation links and Client Portal styling. Browser QA adds three synthetic project values, numbered journey rows and named ARIA progressbar assertions.
- Local Chromium proof used actual static review markup with this CSS at 1440, 1024, 390 and 320px, with no horizontal overflow. Hosted visual and authenticated owner approval remain separate, explicitly unapproved gates.
