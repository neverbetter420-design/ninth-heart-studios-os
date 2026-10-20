# NHS Lead Finder 2.0 — Softr parity blueprint

Status: **review/design blueprint only**. No production schema changes, automations, credentials, merges, or deploys authorized by this file.

## Inspected source of truth (Oct 19, 2026 Pacific)

Actual former Softr app: `Ninth Heart Studios OS` (`12b44731-13fd-48cd-bd77-c6ee2ceb053f`), `/lead-finder`, block `Lead Finder Workspace` (`a4fc3818-2f35-4756-8c54-c6b74ac6deb3`). The block uses separate `Lead Search Requests`, `Lead Search Results`, and Airtable `Leads` data sources. Relevant workflow: `ACTIVE - Free OpenStreetMap Lead Finder v2`, workflow id `a85161c6-ed85-4aff-a381-25e9a21ac207`. **Despite its title, that workflow currently has `enabled: false`; the connected Softr Search Requests and Results tables both have zero records.** Google Places Finder is also disabled/blocked pending an API key. We are reconstructing documented **intended behavior**, not claiming verified current live execution.

The original screen includes:
- Source selector (`OpenStreetMap`; `Google Places` gated by a provider connection), `City, State` location, industry (`Bar`, `Restaurant`, `Bar/Restaurant`), requested results (1–20).
- `Automatically store top leads` toggle and top-count control (1–10, default 5); eligibility requires a verified non-duplicate with an actual website.
- Buttons to queue/find leads and refresh results.
- Left `Recent searches` with source, status (`Queued`, `Searching`, `Complete`, `Error`), imported count, error feedback.
- Separate results area: name, industry, address, phone, email, website, maps, provenance, discovery score, existing/imported badges and a per-result `Import lead` button.
- Import maps the lead into the CRM with acquisition `Outbound`, pipeline `Prospect`, correct next action, and a website audit request **only when a website is available**.
- OSM v2 workflow constructs administrative-boundary queries, attempts primary and backup endpoints, normalizes place identity and completeness (website +50, email +25, phone +15, address +5, hours +5), deduplicates against Leads, writes result snapshots, and optionally imports top eligible leads. Its original retry delays were applied in a separate Softr workflow rather than a synchronous page action.

## Our approved replacement design

Keep **NHS Nocturne: Atelier Edition** layout, typography, floral artwork, and privacy/navigation. Adopt the *workflow* of Softr, not its older neon dashboard styling or inactive integrations.

### Phase A — durable search jobs (new **draft** migration, not yet applied)

Create admin-only, row-level-secured `lead_search_requests` and `lead_search_results` with immutable request parameters and distinct result IDs. Search request statuses: `queued`, `searching`, `complete`, `error` and a safe concise error reason; include `source`, location, filters, result limit, opt-in auto-import, imported count, and timestamps. Results are first-class *review candidates*, not CRM leads. Existing `prospects` and `leads` must remain intact; use the same admin RLS mechanism (`private.is_admin()`). No automatic destructive backfill.

### Phase B — Softr-style review workspace

Render the five search controls and explicit auto-import toggle, plus a mobile-friendly recent-search rail and results view. Search results include business name, category, address, website, phone, email when provided by source, maps link, source identity, discovery-completeness score, and clearly separate **NHS sales-opportunity score**. Show `Duplicate`, `Ready`, `Imported`, and `Needs verification` labels. Show honest Social Verification for Instagram/Facebook: tagged/public profiles are unconfirmed until identity checks succeed. Preserve existing Prospect detail/workspace and promoted Lead workflow, with one clear path to manually import.

### Phase C — independent data ingestion

Provide a reliable authenticated Places provider **only when the owner configures a private server-side API key**. A tested provider adapter should have per-request budget, timeouts, rate limits and transient retry handling; OSM may remain an opt-in free alternative, with explicit failure status. Do not silently add billable APIs or start schedules. Geoapify documentation supports a server-only Places API key with POST structured `filter`/`bias`; branch `fix/scanner-geoapify-primary-20261019` is unreviewed prototype code and is **not** an approved ready-to-deploy dependency. Never expose provider credentials in browser assets.

The old free Overpass strategy is not a reliability guarantee: production screenshots show HTTP 521 and then dual-provider unavailable errors.

### Phase D — dedupe, storage, audits

Normalize stable provider/OSM identifiers and match existing website/email/phone+address carefully; **do not discard separate locations based on matching business names**. Review up to 20 results. Import manually, or opt in to auto-import up to 10 eligible results (default 5). Before every write, re-check duplicates against `leads` and `prospects`. Fail closed on uncertain identity or missing website; no outreach messages ever sent automatically. Attach a website audit job only after a successful eligible import. Preserve today's 12+ saved prospects, accounts, client projects, files and role scoping.

### Phase E — testing and release

- Test no API key, provider timeout, HTTP 521, throttling, empty response, import idempotence, independent same-name businesses, cross-client RLS denial, opt-in limits, skipped/no-website ranking, Instagram/Facebook identity and withheld auto-import.
- Verify complete local Supabase migrations/Auth tests, application/typecheck, desktop and mobile Playwright, Cloudflare dry-run, and actual owner-approved preview.
- **Approval gates**: database migration approval; preview/design signoff; PR merge approval; separate owner-only production deployment on exact main SHA; admin-controlled smoke scan with minimal impact. Never activate a recurring search schedule without explicit approval.

## Reference route

Old Softr `/lead-finder` ⟶ custom NHS OS `/leads/discover`. The shipped page currently runs a synchronous lookup and saves up to 12 prospects directly; it is **not** feature-identical. This document governs the reconstruction before implementation.
