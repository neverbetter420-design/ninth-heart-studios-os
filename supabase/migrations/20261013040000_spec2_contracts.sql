-- Spec 2 — Contracts + e-signature (in-app click-to-accept).
--
-- The signature IS the audit trail: timestamp, signer name/email, IP, and a
-- SHA-256 hash of (body + signer + timestamp) so tampering is detectable.
-- No vendor, no key, no cost.
--
-- State machine: draft → sent → signed, or → voided from draft/sent.
-- Clients only ever see sent+ contracts on their own projects, and the RLS
-- policy enforces the sent→signed transition at the database level.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  template_id uuid references public.templates(id) on delete set null,
  title text not null,
  body text not null default '',
  status text not null default 'draft',
  sent_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_email text,
  signature_hash text,
  signer_ip text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'sent', 'signed', 'voided')),
  check ((project_id is not null) or (opportunity_id is not null))
);

create index if not exists contracts_project_idx on public.contracts(project_id);
create index if not exists contracts_status_idx on public.contracts(status);

alter table public.contracts enable row level security;

-- Admins manage everything.
drop policy if exists "Admins manage contracts" on public.contracts;
create policy "Admins manage contracts" on public.contracts
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Clients read sent+ contracts on their own projects.
drop policy if exists "Clients read own contracts" on public.contracts;
create policy "Clients read own contracts" on public.contracts
  for select to authenticated
  using (
    status in ('sent', 'signed', 'voided')
    and project_id is not null
    and (select private.can_access_project(project_id))
  );

-- Clients sign: may only move their own sent contracts to signed.
drop policy if exists "Clients sign own contracts" on public.contracts;
create policy "Clients sign own contracts" on public.contracts
  for update to authenticated
  using (
    status = 'sent'
    and project_id is not null
    and (select private.can_access_project(project_id))
  )
  with check (
    status = 'signed'
    and project_id is not null
    and (select private.can_access_project(project_id))
  );
