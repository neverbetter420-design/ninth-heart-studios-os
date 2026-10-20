# NHS OS Nocturne: Atelier Edition — isolated static preview release

Reviewed October 18, 2026. **This is a synthetic, source-rendered design preview, not NHS OS staging and never production.**

## Source of truth

- Draft: [PR #16](https://github.com/neverbetter420-design/ninth-heart-studios-os/pull/16)
- Review branch: `design/nocturne-atelier-implementation-20261018`
- Static renderer: `scripts/build-nocturne-static.mjs`
- Fail-closed local validator: `scripts/verify-nocturne-static.mjs`
- Dry-run config: `wrangler.nocturne-static.jsonc` (distinct Worker name; never deploy without authorization)
- CI: [NHS Nocturne isolated HTML review](https://github.com/neverbetter420-design/ninth-heart-studios-os/actions/runs/39182339379) — passed, including 30 actual source-rendered synthetic layouts, no production connections and static asset dry run.
- Companion evidence: the `nhs-nocturne-html-preview` GitHub Actions artifact, with `index.html`, `visual.css`, and 30 `frames/` pages. The artifact is not a public website.

## Safest public design-only review setup

Do **not** alter the production Worker or the Supabase production project. Create a **new Cloudflare Pages** project with a distinct name, such as `nhs-nocturne-atelier-review`, via Cloudflare > Workers & Pages > Create > Pages > Connect to Git.

Use these exact inputs:

| Field | Value |
| --- | --- |
| Git owner/repo | `neverbetter420-design/ninth-heart-studios-os` |
| Production branch **of this separate Pages review project only** | `design/nocturne-atelier-implementation-20261018` |
| Build command | `npm ci && node scripts/build-nocturne-static.mjs && node scripts/verify-nocturne-static.mjs` |
| Build output directory | `nocturne-static-preview` |
| Root directory | `/` |
| Node version | 22 (Pages V3 default; set `NODE_VERSION=22` if not preselected) |
| Additional environment variables | None; no Supabase URL/key, no auth/session token |
| Bindings/Pages Functions | None |
| Custom domain | None; use Cloudflare's separate `*.pages.dev` hostname |
| Deployment policy | Only this review branch; do not build or deploy `main` to this project |

The site displays source-rendered Admin and Client workspaces and allows switching screens/viewport. Buttons, links to actual app records, forms, login, uploads, payments and server actions are disabled. 30 rendered HTML pages use in-memory synthetic reads and local design CSS with embedded artwork. This is **not** a fully functional hosted staging app. Site content is public unless protected separately with Cloudflare Access, so never add any client data or privileged credentials.

Cloudflare connector read calls worked, but its `POST /accounts/{account_id}/pages/projects` returned `10000 Authentication error` during this review. As a result, the project has not been created and no public URL exists. Establish Pages write authorization in Cloudflare integration, or configure the separate project from the Cloudflare dashboard. Do not paste tokens in chat or source.

## Release gates remain separate

1. Visual approval of Admin Nocturne, Client Atelier, and project workspaces.
2. Fully isolated interactive staging requires an independent Supabase project and synthetic Auth users, plus dedicated preview email/redirect bindings. This static review does not establish that infrastructure.
3. Complete restorable production database/Auth/Storage backup, password recovery and DNS/delivery verification, pending security migration approval, exact PR merge approval and exact-main-SHA Worker deployment approval before production rollout.

**Nothing in this document is authorization to deploy NHS OS, migrate Supabase, activate automations or merge draft PRs.**
