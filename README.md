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
