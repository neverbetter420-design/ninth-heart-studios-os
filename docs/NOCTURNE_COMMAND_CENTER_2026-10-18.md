# NHS Nocturne: Atelier Edition — Command Center correction

The owner reported that the draft looked unlike the approved concept. The first screen now follows the agreed dark creative studio direction: open composition, fluid decoration, editorial type and clear working destinations.

## Visual source of truth

- An unframed welcome sits directly on the obsidian canvas. Oversized serif type, soft plum italics and one lead-capture link establish hierarchy.
- One decorative vector drapery composition appears only beside the welcome. It is not the NHS logo, contains no controls and is hidden from assistive technology. On mobile it fades into the right margin; it never receives pointer events.
- Three metrics share a single fine-rule strip. Each keeps the existing live data source.
- Next 3 Actions and Project Pulse are open dark sections. No ivory actions card, outlined hero, bright number badges or stacked dashboard containers.
- Three deterministic Flowkeep priorities retain their individual lead destinations. Project names and the pipeline link retain the existing routes and permission boundaries.
- Recent activity is immediately visible in a quiet timeline below the working sections. Muse and Opportunity Radar remain in an optional, keyboard-operable disclosure.
- The admin navigation floats with a modest inset and rounded outline; it retains labelled destinations, collapsible groups, account controls and the existing mobile drawer. Client styling remains role-scoped.

`app/nocturne-command.css` owns this composition. The old Command Center block was removed from `app/nocturne-phase3.css` rather than leaving two competing screen definitions. `components/NocturneStudioArt.tsx` contains the small decorative vector, without image downloads or new runtime dependencies.

## Logo status

The source repository has no approved logo master. A Library candidate named `Ninth Heart logo with glowing orbit.png` was inspected: it is RGB and has a checkerboard baked into the image. It was not recolored, traced, cropped, background-removed or inserted into the app. The existing shell heart glyph is still a temporary placeholder, not the approved heart/ring/skeleton-key artwork. Final identity acceptance requires the clean original asset.

## Review and verification

Inspect the actual page markup with synthetic populated/empty/long-title data at 320–1440px. The isolated visual suite checks overflow, project progress containment, action reachability, focus visibility, contrast, client sidebar readability and disclosure pointer/keyboard behavior. The populated fixture includes three leads, three projects and three activity entries, all in memory.

Local TypeScript, navigation verification, eight desktop/mobile visual tests and the Next.js production build passed during this correction. GitHub checks on the final commit provide separate app, browser, PostgreSQL, disposable local Supabase and Cloudflare bundle verification; evaluate the actual final run results before release. Static synthetic rendering is not evidence of successful hosted authentication or production writes.

This remains the first screen for owner visual review. It is not acceptance of the rest of the app or a production release. The Client Atelier and project workspace remain the next visual stages once the Command Center direction is accepted.

## Release boundary

Continue in draft PR #14. No hosted database, Auth, Storage, DNS, automation, merge or deployment changes. The existing verified-backup and distinct production approvals remain required before release.
