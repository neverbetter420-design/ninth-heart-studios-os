-- Phase 7 — Muse: draft follow-ups and proposals.
--
-- Drafts are saved work, never dispatches. There is no "sent" status in this
-- phase: sending happens manually (or arrives with Phase 8 integrations).
-- Admin-only table — clients never see studio drafts.

create table if not exists public.muse_drafts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('follow_up', 'proposal', 'check_in')),
  subject text not null,
  body text not null,
  lead_id uuid references public.leads(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'archived')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists muse_drafts_created_at_idx on public.muse_drafts (created_at desc);
create index if not exists muse_drafts_status_idx on public.muse_drafts (status);

alter table public.muse_drafts enable row level security;

drop policy if exists "Admins manage muse drafts" on public.muse_drafts;
create policy "Admins manage muse drafts" on public.muse_drafts
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
