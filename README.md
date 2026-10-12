# Ninth Heart Studios OS

A clean-code rebuild of the Ninth Heart Studios operating system.

## Phase 1 status

This repository contains the new visual shell and product foundation only. It intentionally does **not** connect to live Softr, Airtable, client data, email, or payment systems yet.

### Included

- Next.js App Router + TypeScript
- Tailwind CSS v4/PostCSS setup
- Responsive NHS dark-electric design system
- Command Center dashboard
- Deterministic "Next 3 Actions" UI prototype
- Muse AI panel prototype
- Lead Intelligence route
- Project Pipeline route
- Client Portal route
- Opportunity Radar route
- Master Templates route
- System Settings route
- VS Code workspace and extension recommendations
- Environment template for future Supabase integration

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Safety rule

Do not add production credentials to source control. Use `.env.local` for local development and Vercel/Supabase secret management for deployed environments.

## Build order

See [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md).
