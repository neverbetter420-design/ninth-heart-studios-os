-- Phase 6 — Opportunity Radar: proposal drafts.
-- Proposals belong to opportunities; admin-only like the opportunities table.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  title text not null,
  content text not null default '',
  status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'sent'))
);

create index if not exists idx_proposals_opportunity on public.proposals(opportunity_id);

alter table public.proposals enable row level security;

drop policy if exists "Admins manage proposals" on public.proposals;
create policy "Admins manage proposals" on public.proposals
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
