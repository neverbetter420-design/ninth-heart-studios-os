# Ninth Heart Studios OS

Private application for Ninth Heart Studios, built with Next.js 16, TypeScript and Supabase. Marketing website: [ninthheartstudios.com](https://www.ninthheartstudios.com) (Wix Studio). The application deploys to Cloudflare on a separately configured hostname.

## Implemented

- Command Center, Flowkeep lead intelligence, Pacific business-hour SLA, quick outcomes and priority actions.
- Projects, client memberships, private files, milestones, approvals, launch gates, messages, shared documents and client portal.
- Opportunity Radar with duplicate detection, fit scoring, bid tracking and proposal drafting.
- Muse next-action intelligence, stale lead/risk explanations and human-approved email drafts.
- Automation registry and in-app notifications. All five live automations remain **disabled**, pending explicit approval.
- Gmail SMTP integration with per-send confirmation, if server-side credentials are configured.
- Revision rounds, client pin feedback, change orders and scope-watch logic.
- Master document/contract templates and typed-acceptance contracts.
- Fillable forms (contracts, documents, invoices), client signing, line items and totals.
- PDF imports: AcroForm extraction or heuristic suggestions; private source PDFs saved in `form-sources`.

## Setup

Install with `npm ci`; copy `.env.example` to an untracked `.env.local`; configure Supabase settings, then run `npm run dev`.
Never put service-role keys, SMTP passwords, test credentials or session tokens in client-exposed `NEXT_PUBLIC_*` variables.

Apply files in `supabase/migrations/` in chronological order and verify remote history. Migration `20261013232917_secure_client_document_updates.sql` enforces contract/form metadata immutability and recomputes signature timestamps, hashes and invoice totals at the database layer without overwriting existing data.

PDF import accepts files up to 25 MiB. Next Server Action requests allow 30 MB to accommodate multipart overhead. Confirm Cloudflare worker memory/runtime limits with a 1 MB and 20 MB PDF test before accepting customer documents. Imported PDF templates begin inactive for manual review.

## Verification

```bash
npm run typecheck
npm run build
npm run verify:security
npm run verify:flowkeep
npm run verify:muse
npm run verify:automations
npm run verify:email
npm run verify:contracts
npm run verify:templates
npm run verify:forms
```

The security verification uses configured test identities, not real customer accounts. See [security model](docs/SECURITY_MODEL.md) and [blueprint](docs/BLUEPRINT.md).

## Password recovery (production)

**Operational recovery checklist:** [production delivery and deployment runbook](docs/AUTH_RECOVERY_PRODUCTION.md). The deployed Cloudflare Worker must be updated independently of GitHub; Supabase requires a production SMTP service for reliable email delivery.


NHS OS is hosted on `https://app.ninthheartstudios.com`, separate from the public Wix website.

1. In **Supabase > Authentication > URL Configuration**, set **Site URL** to `https://app.ninthheartstudios.com`.
2. Add **Redirect URL** `https://app.ninthheartstudios.com/auth/reset-password?recovery=1`. For development, also add `http://localhost:3000/auth/reset-password?recovery=1` if needed. The production URL must be allowlisted or Supabase may fall back to the wrong Site URL.
3. Set the Cloudflare server-side environment variable `NHS_APP_URL=https://app.ninthheartstudios.com` (optional if using the built-in production default). Do not use the marketing Wix website URL.
4. For robust cross-device recovery, in **Supabase > Authentication > Email Templates > Reset Password**, use a token-hash link to the already supported server callback rather than the default implicit/PKCE verification link. Keep your branded email body and update the anchor only:

   ```html
   <a href="{{ .SiteURL }}/auth/callback?flow=recovery&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
   ```

   This requires the Site URL above. The callback verifies the one-use recovery token on the server; it does not authenticate other users or bypass the existing roles. The default Supabase email template remains supported for same-browser recovery via the direct reset page.

After deploy/configuration, test with an **isolated invited test user**: request a reset on the live hostname, open the newest email link, set a password of at least 12 characters, and sign in again. Test both an invalid/expired URL and a direct visit to `/auth/reset-password` without a link. Never use real client accounts for test resets.

## Nocturne implementation review

The Nocturne: Atelier Edition follow-up is on a draft review branch. See the
[implementation and review guide](docs/NOCTURNE_IMPLEMENTATION_REVIEW_2026-10-18.md)
for the local synthetic preview, desktop/mobile screenshots, validation and
separate production release gates. Run `npm run preview:design` to start the
read-only visual review at `http://127.0.0.1:4173`; it does not sign in or use
hosted data. Set `NHS_VISUAL_BUILT_CSS=1` after `npm run build` to include the
production stylesheet and fonts. These source changes have not been deployed.
