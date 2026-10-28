-- Deep Scan Mode, draft migration only. MUST be reviewed and separately applied
-- before enabling the new UI. No background job or cron is created.
create table if not exists public.deep_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  location text not null check (length(location) between 2 and 160),
  area_label text not null,
  radius_m integer not null check (radius_m between 1609 and 80467),
  niches text[] not null check (cardinality(niches) between 1 and 7),
  requested integer not null check (requested in (12, 25, 50, 100)),
  candidates jsonb not null check (jsonb_typeof(candidates) = 'array' and jsonb_array_length(candidates) between 1 and 100),
  position integer not null default 0 check (position between 0 and 100),
  processed integer not null default 0 check (processed between 0 and 100),
  created_count integer not null default 0 check (created_count between 0 and 100),
  refreshed_count integer not null default 0 check (refreshed_count between 0 and 100),
  held_count integer not null default 0 check (held_count between 0 and 100),
  conflict_count integer not null default 0 check (conflict_count between 0 and 100),
  status text not null default 'ready' check (status in ('ready', 'running', 'paused', 'completed', 'cancelled')),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position <= jsonb_array_length(candidates)),
  check (processed = position),
  check ((status = 'running') = (lease_token is not null and lease_until is not null))
);
create index if not exists deep_scan_jobs_owner_created_idx
  on public.deep_scan_jobs (created_by, created_at desc);

alter table public.deep_scan_jobs enable row level security;
revoke all on public.deep_scan_jobs from anon;
revoke all on public.deep_scan_jobs from authenticated;
grant select, insert, update on public.deep_scan_jobs to authenticated;
drop policy if exists "Admins manage deep scan jobs" on public.deep_scan_jobs;
create policy "Admins manage deep scan jobs"
  on public.deep_scan_jobs for all to authenticated
  using ((select private.is_admin()) and created_by = (select auth.uid()))
  with check ((select private.is_admin()) and created_by = (select auth.uid()));

-- Atomic lease: two repeated clicks cannot run the same batch concurrently.
-- Expired leases become claimable, so an interrupted request can be resumed.
create or replace function public.claim_deep_scan_batch(p_id uuid)
returns setof public.deep_scan_jobs
language sql volatile security invoker
set search_path = ''
as $$
  update public.deep_scan_jobs j
  set status = 'running', lease_token = gen_random_uuid(),
      lease_until = now() + interval '90 seconds',
      last_error = null, updated_at = now()
  where j.id = p_id
    and j.created_by = (select auth.uid())
    and (select private.is_admin())
    and j.position < jsonb_array_length(j.candidates)
    and (j.status = 'ready'
      or (j.status = 'running' and j.lease_until < now()))
  returning j.*;
$$;

-- Finish only with the live lease token. Progress increments in ONE transaction
-- and cannot double-count a previously completed batch.
create or replace function public.finish_deep_scan_batch(
  p_id uuid, p_lease uuid, p_processed integer,
  p_created integer, p_refreshed integer, p_held integer, p_conflicts integer
)
returns setof public.deep_scan_jobs
language sql volatile security invoker
set search_path = ''
as $$
  update public.deep_scan_jobs j
  set position = j.position + p_processed,
      processed = j.processed + p_processed,
      created_count = j.created_count + p_created,
      refreshed_count = j.refreshed_count + p_refreshed,
      held_count = j.held_count + p_held,
      conflict_count = j.conflict_count + p_conflicts,
      status = case when j.position + p_processed >= jsonb_array_length(j.candidates)
        then 'completed' else 'ready' end,
      lease_token = null, lease_until = null, updated_at = now()
  where j.id = p_id and j.created_by = (select auth.uid())
    and (select private.is_admin()) and j.status = 'running'
    and j.lease_token = p_lease and j.lease_until > now()
    and p_processed between 1 and 6
    and j.position + p_processed <= jsonb_array_length(j.candidates)
    and p_created between 0 and p_processed
    and p_refreshed between 0 and p_processed
    and p_held between 0 and p_processed
    and p_conflicts between 0 and p_processed
    and p_created + p_refreshed + p_held + p_conflicts <= p_processed
  returning j.*;
$$;

create or replace function public.pause_deep_scan_batch(p_id uuid, p_lease uuid, p_error text)
returns setof public.deep_scan_jobs
language sql volatile security invoker
set search_path = ''
as $$
  update public.deep_scan_jobs j
  set status = 'paused', lease_token = null, lease_until = null,
      last_error = left(p_error, 250), updated_at = now()
  where j.id = p_id and j.created_by = (select auth.uid())
    and (select private.is_admin()) and j.status = 'running'
    and j.lease_token = p_lease
  returning j.*;
$$;

revoke all on function public.claim_deep_scan_batch(uuid) from public, anon;
revoke all on function public.finish_deep_scan_batch(uuid,uuid,integer,integer,integer,integer,integer) from public, anon;
revoke all on function public.pause_deep_scan_batch(uuid,uuid,text) from public, anon;
grant execute on function public.claim_deep_scan_batch(uuid) to authenticated;
grant execute on function public.finish_deep_scan_batch(uuid,uuid,integer,integer,integer,integer,integer) to authenticated;
grant execute on function public.pause_deep_scan_batch(uuid,uuid,text) to authenticated;
