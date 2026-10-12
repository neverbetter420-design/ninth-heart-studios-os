# NHS OS Security Model

## Trust boundaries

The browser is never treated as an authorization boundary. Hiding navigation, buttons, or routes is presentation only. Data authorization is enforced in Postgres with Row Level Security.

## Roles

### NHS Admin

Admins can access all studio operational records, including leads, opportunities, templates, projects, internal tasks, internal activity, and client records.

### NHS Client

Clients can access only records connected to a `client_memberships` row for their authenticated profile. They can read:

- Their client account
- Their projects
- Tasks marked `client_visible = true`
- Activities marked `client_visible = true`
- Client-visible file metadata
- Approvals for their projects

Client approval mutation is intentionally not enabled in Phase 2. It will be added with the approval workflow so the allowed state transitions can be constrained deliberately.

## Authentication

Authentication uses Supabase Auth with server-rendered, cookie-backed sessions. Next.js 16 uses `proxy.ts` to refresh/validate auth cookies before Server Components run.

Public signup is not implemented in the app. Accounts are intended to be created/invited by NHS.

## Authorization source

Authorization comes from `public.profiles.role` and `public.client_memberships`. Role decisions are not based on editable `user_metadata`.

The new-user trigger may use server-controlled `raw_app_meta_data.role` during trusted account creation, then persists the role into `public.profiles`.

## RLS helper functions

Authorization helper functions live in the non-exposed `private` schema. Security-definer helpers use an empty `search_path` and schema-qualified object names.

Execution is revoked from `public` and `anon`, then granted only to `authenticated`.

## Storage

The `project-files` bucket is private.

Path layout:

`client_uuid/project_uuid/visibility/filename`

Where `visibility` is either:

- `client`
- `internal`

Client policies verify both client/project membership and the `client` visibility segment. Internal objects remain admin-only.

## Service-role key

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is allowed only in trusted setup/maintenance scripts and future server-only jobs that explicitly require it.

It must never:

- use a `NEXT_PUBLIC_` name
- be referenced from Client Components
- be committed to Git
- be placed in browser-visible hosting variables

## Browser hardening

Next.js sends basic security headers globally: frame denial, MIME sniffing protection, strict referrer behavior, restricted camera/microphone/geolocation permissions, and same-origin opener isolation.

## Production Auth hardening

Before production, configure strong password rules in Supabase Auth, keep public signups disabled, enable appropriate rate-limit/bot protections, and require MFA for NHS Admin accounts when the production admin workflow is ready.

## Phase 2 release gate

Before any production migration:

1. Apply migrations in a non-production Supabase project.
2. Create the private `project-files` bucket.
3. Seed Admin, Client A, and Client B test accounts.
4. Run `npm run verify:security`.
5. Confirm Client A cannot retrieve Client B project IDs even through direct API calls.
6. Confirm admin-only tables return no rows to clients.
7. Confirm internal tasks and internal files do not leak to clients.
8. Only then begin production data mapping.
