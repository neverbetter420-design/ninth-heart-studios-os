-- Prospect Scanner: raw scraped businesses (pre-lead), website signals, outreach drafts.
-- Prospects are admin-only working data. Promoting a prospect creates a real lead.

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  category text,
  address text,
  phone text,
  website text,
  signals jsonb not null default '{}'::jsonb,
  opportunity_score integer check (opportunity_score is null or (opportunity_score between 0 and 100)),
  outreach_draft text,
  outreach_status text not null default 'none' check (outreach_status in ('none', 'drafted', 'sent')),
  status text not null default 'new' check (status in ('new', 'promoted', 'archived')),
  lead_id uuid references public.leads(id) on delete set null,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on public.prospects (status);
create index if not exists prospects_score_idx on public.prospects (opportunity_score desc);
-- Dedupe is handled in the scan action (case-insensitive name match); no unique
-- constraint here so rescans with slightly different website URLs don't hard-fail.

alter table public.prospects enable row level security;

drop policy if exists "Admins manage prospects" on public.prospects;
create policy "Admins manage prospects" on public.prospects
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
