# Ninth Heart Studios OS

Custom operating system for Ninth Heart Studios. This codebase replaces platform-limited tooling with an owned Next.js application while the current Softr/Airtable system remains operational during migration.

## Current state: Phase 2

Phase 2 adds the real security/data foundation:

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

The existing dashboard modules still use mock operational data where Phase 3+ workflows have not been implemented yet.

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

Security architecture is documented in:

`docs/SECURITY_MODEL.md`

## Security verification

After applying the migrations and seeding the test users:

```bash
npm run verify:security
```

Do not import production client records until the isolation checks pass.

## GitHub

See `docs/GITHUB_SETUP.md` for the existing private-repository handoff instructions.
