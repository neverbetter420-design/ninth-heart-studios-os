# NHS OS visual-first room density standard

Status: **source-only design review**, stacked on the Velvet Atelier/Rooms design branch.
No production deployment, hosted preview publication, database mutation, scan, outreach,
paid integrations, Muse activation or feature flag changes are authorized.

## Intent

The owner's November 6 direction: *all pages should avoid text-heavy layouts whenever reasonable*.
Room UI should prioritize useful information and direct actions. Remove redundant editorial
copy, not informative labels, accessibility text, safety notes, error states or consent gates.

## Changes in this pass

- Shared, late-loaded `app/visual-first.css` styles concise introductions, highly visible
  keyboard focus and open, comfortable room layouts across admin/client surfaces.
- Scanner Best Fits: a 70% contact / 30% website-opportunity weighting strip explains
  ranking at a glance. Full criteria, limits and no-auto-contact protection remain in an
  accessible native disclosure.
- Scanner Insights: territory interpretation and conversion methodology move to native
  disclosures; incomplete-data notices and sample caveats remain visible.
- Scanner Saved Prospects: repeat evidence rows collapse under one native “Research & evidence”
  disclosure per business. Contact/site/status facts and actions stay on the card.
  Inner disclosures retain source details, provenance, safety context and links.
- Lead Intelligence, Clients, Projects, Contracts, Automations and Settings get one-sentence
  introductions. Existing metrics, statuses, forms, filters and server actions remain.
- Automations and Settings get SVG icon-led, readable destination links.
- The already approved dark portal, independent room art, original logo and Rooms navigation
  are inherited without modifying their behavior.

## Non-negotiable guardrails

1. Never hide an error, unavailable-data condition, destructive action warning,
   security/privacy disclosure, consent requirement, or client approval behind decoration.
2. Icons support visible text labels, not replace them. All disclosure controls are keyboard
   operable, retain focus styles, and use semantic `<details>/<summary>`.
3. On mobile, no forced horizontal scroll or icons obscuring content. Respect reduced motion,
   forced colors and text zoom.
4. No fabricated data, automatic prospect outreach, or changed business logic.
5. Source-only draft review; existing PR #68 gates still apply.

## Review / acceptance

- Run `npm run typecheck` and `npm run build` with isolated placeholder environment.
- Run open-plan responsive and axe tests for desktop, tablet and 320–430px mobile.
- Confirm Best Fits weighting and disclosures; expand nested prospect evidence by keyboard;
  verify all action forms still work and loading/error states remain legible.
- Review all seven room backgrounds and Client A/Client B portal isolation on disposable
  accounts before ever considering a release. No automated test substitutes for visual
  approval or authorizes deploy.
