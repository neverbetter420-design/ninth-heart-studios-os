# Lead Finder 2.0 — release and configuration checklist

**Status: migration applied, application draft not yet installed on live NHS OS.** PR #20 adds new search-review staging tables and the Softr-style UI/action code. Keep the production database, current Cloudflare Worker, and existing prospects intact until the owner approves each gate below.

## Source of business results

- `OpenStreetMap`: no key required, currently unreliable on the free public Overpass instances (production has observed HTTP 521 and timed-out mirrors). Best effort only.
- `Geoapify`: supported, server-side Places API. The source selector stays disabled until the **server-only** secret `GEOAPIFY_API_KEY` is configured and available to the runtime. The API key must **never** appear as a public `NEXT_PUBLIC_` variable or browser JS. See https://apidocs.geoapify.com/docs/places/ .
- The app uses a single provider selected per search. No hidden provider billing or automatic schedules. The result snapshot is always separate from CRM import.

## Before anyone modifies production

1. Review PR #20 changes and synthetic visual artifact. Compare them with Softr's original Search → Recent Searches → Review Results → Import flow. Keep Nocturne's appearance.
2. Verify the disposable Supabase local Auth/REST job passes, including client denial of lead-search reads/writes, plus the existing security suite. Verify mobile/browser and OpenNext dry-run checks pass.
3. Owner confirms access to a **restorable** Supabase backup and production `production` GitHub environment protection.
4. Owner explicitly approves running `supabase/migrations/20261020063055_lead_search_review_queue.sql` on the live Supabase project. Test table creation, grants, RLS, initial zero rows, unchanged counts for `leads`, `prospects`, `clients`, `projects` and `storage.objects`. **Completed via explicit owner approval.** Supabase assigned schema ledger version `20261020063055` to the exact SQL from originally approved `20261020050000_lead_search_review_queue.sql`. The source file was renamed to match the installed version; no second application is required.
5. **Blocker: draft-only cross-search uniqueness guard.** Review `docs/LEAD_FINDER_IDEMPOTENCY_SQL_REVIEW_ONLY.sql` and run only its read-only duplicate preflight first. The two proposed partial unique indexes on `leads.metadata.source_ref` and `leads.metadata.import_key` have **NOT** been installed in production. After a fresh explicit owner approval, create a proper new Supabase migration with `supabase migration new`, include the reviewed DDL, apply it separately, and verify its uniqueness + row counts before allowing simultaneous or top-N imports. Reconcile any collisions manually; never delete existing leads automatically.
6. Review the OpenStreetMap fixes integrated from draft PR #19 into PR #20: bounded JSON response bodies, Nominatim → US-restricted Photon failover, existing two-Overpass endpoint fallback, and regression tests. Do not blindly merge #19 because its base overlaps with later updates to `main`.
7. Owner creates a free/approved Geoapify account and key if this provider is desired. Store it as `GEOAPIFY_API_KEY` only in production Worker secrets/settings. Check secret-binding metadata, not the secret value. Confirm availability to the Worker environment before enabling the Geoapify source. No customer credentials are needed in a GitHub issue.
8. After verifying migrations and key, owner separately approves merging the exact tested PR head to `main`. No auto deploy on merge.
9. Trigger GitHub's protected manual `deploy-cloudflare.yml` workflow against the exact reviewed **new** `main` SHA with its required three parameters. Never copy an earlier release SHA.
10. Log in as NHS Admin and perform one small Geoapify scan (Puyallup, 5 miles, Restaurants, max 5) **without auto-import**. Verify `queued/searching/complete` state, results, source labels, map/site/social links, duplicate badges, no DB writes to `leads` or `prospects`.
11. Manually import a single unique website-bearing test business only with explicit consent, verify exactly one `leads` row, metadata provenance, and idempotency on a second click. Retain original staged result for audit.
12. Check client A and B cannot navigate to scanner nor access staging tables, then confirm existing portal, projects, files and password recovery are intact. Only after this consider enabling optional bulk/top-5 automatic import.

## Safeguards

- Search is **on-demand** (no background/recurring activation).
- Auto-import defaults **off**; eligible results need a non-social website and must not match existing leads/prospects.
- Review candidates are **not** CRM leads until imported.
- A provider error is preserved as a search status; no existing lead data is discarded.
- Instagram/Facebook links are marked **unconfirmed** until business identity matches.
- Current `prospects` scoring is an NHS opportunity score, while result `discovery_score` is solely contact completeness.
- The app checks same-source staged imports and existing CRM metadata before importing, but those checks alone are **not a transaction-level uniqueness guarantee**. The proposed indexes must be separately approved and applied before release.
- Auto-import defaults off; do not enable it for the release until the database idempotency guard is installed and verified.
- An interrupted import may stay in `importing` for manual reconciliation instead of retrying ambiguously and duplicating a lead.
