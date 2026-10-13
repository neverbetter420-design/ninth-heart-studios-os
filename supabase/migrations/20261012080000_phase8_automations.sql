-- Phase 8 — Automations + Integrations: automation registry, audit trail, notifications.
--
-- Design principles (from the blueprint):
-- - "Carefully scoped notifications" — notifications are in-app, admin-only.
-- - "Automation audit trail and kill switches" — every run is logged; every
--   automation has an enabled flag that acts as a kill switch.
-- - Nothing sends externally in this phase. Email/calendar/payments arrive as
--   provider interfaces with keys supplied later — the tables below are the
--   seams they plug into.

-- Registry of automations. Each row is one automation the studio can toggle.
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null default '',
  kind text not null default 'internal',
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind in ('internal', 'email', 'calendar', 'payments', 'lead_source')),
  check (last_status is null or last_status in ('ok', 'error', 'skipped'))
);

-- Audit trail: every automation run, what it did, what happened.
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'ok',
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  check (status in ('ok', 'error', 'skipped'))
);

create index if not exists automation_runs_automation_idx
  on public.automation_runs(automation_id, started_at desc);

-- In-app notifications. Admin-only; nothing leaves the app.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  href text,
  kind text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind in ('info', 'warning', 'action'))
);

create index if not exists notifications_created_idx
  on public.notifications(created_at desc);

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Admins manage automations" on public.automations;
create policy "Admins manage automations" on public.automations
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins read automation runs" on public.automation_runs;
create policy "Admins read automation runs" on public.automation_runs
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins manage notifications" on public.notifications;
create policy "Admins manage notifications" on public.notifications
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Seed the registry with the built-in internal automations (disabled by default —
-- Hailey turns on what she wants; nothing runs without explicit approval).
insert into public.automations (key, name, description, kind, enabled, config)
values
  ('stale_lead_digest', 'Stale lead digest',
   'Daily in-app digest of leads going quiet (uses the Muse stale-lead engine).',
   'internal', false, '{"threshold_days": 7}'::jsonb),
  ('sla_watch', 'SLA watch',
   'Flags inbound leads whose reply SLA is breached or due soon.',
   'internal', false, '{}'::jsonb),
  ('project_risk_scan', 'Project risk scan',
   'Daily scan of active projects; notifies on new high/critical risks (uses the Muse risk engine).',
   'internal', false, '{}'::jsonb),
  ('approval_nudge', 'Approval nudge',
   'Reminds when client approvals sit pending past N days.',
   'internal', false, '{"pending_days": 3}'::jsonb)
on conflict (key) do nothing;
