-- NHS Lead Finder 2.0 search-review queue (DRAFT ONLY).
-- This creates new admin-only tables; it does NOT import leads, modify prospects,
-- touch existing client records, call external providers, or enable schedules.
-- Production application requires a separately approved migration + deployment.

create table if not exists public.lead_search_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  source text not null default 'openstreetmap'
    check (source in ('openstreetmap', 'geoapify')),
  location text not null
    check (length(btrim(location)) between 2 and 200),
  industry text not null default 'Bar/Restaurant'
    check (length(industry) between 1 and 80),
  niches text[] not null default '{}',
  radius_mi integer not null default 10
    check (radius_mi between 1 and 50),
  result_limit integer not null default 20
    check (result_limit between 1 and 20),
  auto_import boolean not null default false,
  top_count integer not null default 5
    check (top_count between 1 and 10),
  status text not null default 'queued'
    check (status in ('queued', 'searching', 'complete', 'error')),
  result_count integer not null default 0
    check (result_count between 0 and 20),
  imported_count integer not null default 0
    check (imported_count between 0 and 20),
  error_message text
    check (error_message is null or length(error_message) <= 500),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_search_counts_consistent check (imported_count <= result_count)
);

create index if not exists lead_search_requests_history_idx
  on public.lead_search_requests (created_at desc);
create index if not exists lead_search_requests_status_idx
  on public.lead_search_requests (status, created_at desc);

create table if not exists public.lead_search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.lead_search_requests(id)
    on delete cascade,
  source_ref text not null
    check (length(source_ref) between 3 and 260),
  business_name text not null
    check (length(btrim(business_name)) between 1 and 240),
  industry text,
  address text,
  city text,
  phone text,
  email text,
  website text,
  maps_url text,
  source text not null,
  discovery_score integer not null default 0
    check (discovery_score between 0 and 100),
  duplicate boolean not null default false,
  imported boolean not null default false,
  import_status text not null default 'ready'
    check (import_status in ('ready', 'importing', 'duplicate', 'imported', 'needs_verification', 'skipped')),
  prospect_id uuid references public.prospects(id)
    on delete set null,
  lead_id uuid references public.leads(id)
    on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_search_result_unique_source unique (search_id, source_ref)
);

create index if not exists lead_search_results_search_idx
  on public.lead_search_results (search_id, discovery_score desc);
create index if not exists lead_search_results_import_idx
  on public.lead_search_results (import_status);

alter table public.lead_search_requests enable row level security;
alter table public.lead_search_results enable row level security;

-- Match existing NHS prospects' trusted, server-defined admin check.
drop policy if exists "Admins manage lead search requests"
  on public.lead_search_requests;
create policy "Admins manage lead search requests"
  on public.lead_search_requests for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins manage lead search results"
  on public.lead_search_results;
create policy "Admins manage lead search results"
  on public.lead_search_results for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Existing public.prospects and public.leads are deliberately unchanged.
