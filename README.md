# Ninth Heart Studios OS

Custom operating system for Ninth Heart Studios. This codebase replaces platform-limited tooling with an owned Next.js application while the current Softr/Airtable system remains operational during migration.

## Current state: Phase 5

Phase 2 established the security/data foundation. Phase 3 added the Flowkeep lead engine. Phase 4 delivered the Project Delivery system, and Phase 5 built the Client Portal (per-project message threads + shared documents):

- Next.js 16 + TypeScript
- Tailwind CSS 4
- Supabase Auth with cookie-backed SSR sessions
- Admin/client route separation
- `NHS Admin` and `NHS Client` application roles
- Client memberships for multi-user client accounts
- Postgres Row Level Security
- Private project-file Storage policies
- Client portal reading real Supabase project data
- Test-user seeding script
- Cross-client isolation verification script
- One-field lead capture
- Inbound/outbound acquisition modes
- Pacific business-day SLA logic
- Quick-log outcomes
- Deterministic Next 3 Actions ranking
- Live lead inbox and lead detail timeline
- Project pipeline, workspace, milestones, tasks, approvals, launch gates, files
- Client portal message threads + shared documents

Opportunity Radar (Phase 6) and Muse intelligence (Phase 7) are next.

- Next.js 16 + TypeScript
- Tailwind CSS 4
- Supabase Auth with cookie-backed SSR sessions
- Admin/client route separation
- `NHS Admin` and `NHS Client` application roles
- Client memberships for multi-user client accounts
- Postgres Row Level Security
- Private project-file Storage policies
- Client portal reading real Supabase project data
- Test-user seeding script
- Cross-client isolation verification script
- One-field lead capture
- Inbound/outbound acquisition modes
- Pacific business-day SLA logic
- Quick-log outcomes
- Deterministic Next 3 Actions ranking
- Live lead inbox and lead detail timeline

Lead Intelligence and the Command Center priority engine now use live Supabase records. Project pulse, Opportunity Radar, and some activity widgets remain mock previews until their later build phases.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Without valid Supabase credentials, protected routes cannot authenticate.

## Supabase setup

Follow `docs/PHASE_2_SETUP.md` before signing in.

The database migrations are:

- `supabase/migrations/20261012020000_phase2_schema.sql`
- `supabase/migrations/20261012020050_phase2_auth_helpers.sql`
- `supabase/migrations/20261012020100_phase2_rls.sql`
- `supabase/migrations/20261012030000_phase3_flowkeep.sql`
- `supabase/migrations/20261012040000_phase4_delivery.sql`
- `supabase/migrations/20261012040001_phase4_client_approvals.sql`
- `supabase/migrations/20261012050000_phase5_portal.sql`

Security architecture is documented in:

`docs/SECURITY_MODEL.md`

## Security verification

After applying the migrations and seeding the test users:

```bash
npm run verify:security
npm run verify:flowkeep
```

Do not import production client records until the isolation checks pass.

## GitHub

See `docs/GITHUB_SETUP.md` for the existing private-repository handoff instructions.
