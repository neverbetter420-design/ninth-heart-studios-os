# Scanner: lower missing-website priority and check social profiles

An unconfirmed website now scores **10 instead of 35**. A matching social profile does not add an absence bonus. Existing loaded prospects are rescored and ordered for display, and promotion uses the current score; future scans persist it. The existing 60-row results window remains in place, so older prospects outside it require another scan or re-analysis.

Discovery reads `contact:instagram` / `contact:facebook` (and legacy equivalents) from the same OpenStreetMap business object. It also recognizes Facebook/Instagram URLs in the website field and social profile links on the business homepage. A social page is not audited as an independent business website. Re-analysis refreshes the same OSM object's social tags and retains previously discovered profiles when the refresh is unavailable.

Up to one profile per platform is checked through bounded, public HTTP reads. A match requires the business name in the profile title plus a phone or street/city match in visible text or description metadata. Script bundles are excluded from identity evidence. Login walls, blocked requests, redirects away from valid platform profiles, missing context and wrong-business results remain **Needs verification**. These are business-detail matches, not platform verification badges, proof the business is active, or proof a website does not exist.

A matching profile may supply one explicitly labelled website or `rel=me` link. Unlabelled posts, advertisements, unrelated JSON, generic platform/directory links and conflicting website candidates are not adopted. An unambiguous link is analyzed with the existing URL, redirect, timeout and response-size protections. Profile links use exact allowlisted hosts, canonical paths and strict redirects, with no cookies, authentication tokens or login bypass.

The UI shows profile links and match evidence, plus manual Instagram/Facebook search links when an independent website remains unconfirmed. It searches the available listing/homepage for profile links; it does not claim a comprehensive name-based search of every social account. No new Meta account connection or search-provider credential is required.

## Verification

- `verify:scanner` exercises discovery tags, normalization, low scoring, phone/location matches, wrong identities, blocked/login pages, hostile redirects, script-only identity claims, website recovery, ordinary post links, conflicting websites and exact-object refresh.
- Source-rendered desktop/mobile scanner cases verify cached score 35 becomes 10, stronger website issues sort above it, profile/search destinations, review labels and 320–1440px layout containment.
- Current build and CI results are recorded in draft PR #14. Network responses in scanner tests are synthetic; there is no guarantee Meta will expose every public profile to an automated request.

No schema migration or hosted data change is included. This remains draft-only, with the existing production backup and separate release approvals required.

Tag references: [Instagram](https://wiki.openstreetmap.org/wiki/Key:contact:instagram), [Facebook](https://wiki.openstreetmap.org/wiki/Key:contact:facebook).
