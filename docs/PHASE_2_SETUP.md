# Phase 2 Setup — Supabase + Authentication

Phase 2 adds the database and permission boundary for NHS OS. Softr and Airtable remain untouched.

## 1. Create a Supabase project

Create a new Supabase project dedicated to the custom NHS OS. Do not reuse a production project from another app.

From the Supabase **Connect** dialog, copy:

- Project URL
- Publishable key
- Service-role key (server-only setup/seed scripts)

Copy `.env.example` to `.env.local` and fill in the values. Never commit `.env.local`.

## 2. Apply the migration

If you use the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or run the Phase 2 migration files in timestamp order in the Supabase SQL editor. After Phase 2 is applied, continue with `docs/PHASE_3_FLOWKEEP.md` and the Phase 3 Flowkeep migration.

The migration creates:

- `profiles`
- `clients`
- `client_memberships`
- `leads`
- `projects`
- `tasks`
- `activities`
- `opportunities`
- `templates`
- `files`
- `approvals`
- Admin/client authorization helpers
- RLS policies
- Private Storage policies for the `project-files` bucket

## 3. Create the private Storage bucket

In Supabase Storage, create a bucket named exactly:

`project-files`

Keep the bucket **Private**.

Recommended initial limits:

- Max file size: 15 MB
- Allowed file types: PDF, DOC/DOCX, PNG, JPEG, WebP, TXT, CSV

The migration already installs the object RLS policies. Client-visible paths use:

`<client_uuid>/<project_uuid>/client/<filename>`

Internal-only paths use:

`<client_uuid>/<project_uuid>/internal/<filename>`

Clients cannot read the `internal` path.

## 4. Auth configuration

NHS OS is invite-only. In Supabase Auth settings:

- Disable public user signups for production.
- Use email/password for the initial Phase 2 build.
- Set the Site URL to the deployed NHS OS URL when production hosting exists.
- Add your local development redirect URL while developing.

The application uses cookie-backed SSR auth with `@supabase/ssr`.

## 5. Seed isolated test accounts

Use long temporary passwords in `.env.local`, then run:

```bash
npm run seed:test-users
```

This creates:

- NHS Admin Test
- NHS Client A
- NHS Client B
- One separate test client/company and project for each client user
- One client-visible task and one internal task per seeded project
- A pending approval

The service-role key is used only by the seed script. It must never be exposed to browser code.

## 6. Verify RLS behavior

Run:

```bash
npm run verify:security
```

The script verifies:

- Admin can read both test projects.
- Client A cannot read Client B's project.
- Client B cannot read Client A's project.
- Clients cannot read leads.
- Clients receive only client-visible tasks.
- Clients cannot update projects.

Also run the database tests when using the local Supabase CLI:

```bash
supabase test db
```

Do not import production client data until the cross-client tests pass.
