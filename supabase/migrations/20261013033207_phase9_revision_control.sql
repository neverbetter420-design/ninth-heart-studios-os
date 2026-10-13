-- Phase 9 (spec 5) — Revision control: revision rounds, visual feedback pins,
-- change orders, and the deterministic scope-creep guard's data home.
--
-- Tables:
-- - revision_rounds: one row per revision round on a project. `included_rounds`
--   is the package allowance (e.g. 3); rounds beyond it are billable territory.
-- - feedback_pins: client comments pinned to a spot (x/y, 0-100) on a shared
--   deliverable (page_url or screenshot ref) inside a round.
-- - change_orders: priced scope changes, drafted from feedback pins or the
--   Muse scope-creep guard. Client never writes these — admin only.
--
-- RLS mirrors the Phase 5 portal pattern: admins manage everything; clients
-- read rows on their own projects, and may add feedback pins on open rounds
-- of their own projects (the server action enforces "open round").
--
-- Also seeds the automation registry with `change_order_watch` (disabled by
-- default, like every Phase 8 automation — Hailey flips the kill switch).

create table if not exists public.revision_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  round_number integer not null,
  status text not null default 'open',
  included_rounds integer not null default 3,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (round_number > 0),
  check (included_rounds >= 0),
  check (status in ('open', 'closed')),
  unique (project_id, round_number)
);

create table if not exists public.feedback_pins (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.revision_rounds(id) on delete cascade,
  page_url text not null default '',
  x numeric not null default 50 check (x >= 0 and x <= 100),
  y numeric not null default 50 check (y >= 0 and y <= 100),
  comment text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_pin_id uuid references public.feedback_pins(id) on delete set null,
  description text not null,
  fee_impact numeric,
  timeline_impact text,
  status text not null default 'draft',
  proposed_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('draft', 'proposed', 'approved', 'declined'))
);

create index if not exists idx_revision_rounds_project on public.revision_rounds(project_id);
create index if not exists idx_feedback_pins_round on public.feedback_pins(round_id);
create index if not exists idx_change_orders_project on public.change_orders(project_id);
create index if not exists idx_change_orders_status on public.change_orders(status);

alter table public.revision_rounds enable row level security;
alter table public.feedback_pins enable row level security;
alter table public.change_orders enable row level security;

-- Revision rounds: admins manage; clients read their own projects' rounds.
drop policy if exists "Admins manage revision rounds" on public.revision_rounds;
create policy "Admins manage revision rounds" on public.revision_rounds
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own project rounds" on public.revision_rounds;
create policy "Clients read own project rounds" on public.revision_rounds
  for select to authenticated
  using ((select private.can_access_project(project_id)));

-- Feedback pins: admins manage; clients read + add pins on their own projects.
drop policy if exists "Admins manage feedback pins" on public.feedback_pins;
create policy "Admins manage feedback pins" on public.feedback_pins
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own project pins" on public.feedback_pins;
create policy "Clients read own project pins" on public.feedback_pins
  for select to authenticated
  using (
    (select private.can_access_project(
      (select rr.project_id from public.revision_rounds rr where rr.id = feedback_pins.round_id)
    ))
  );

drop policy if exists "Clients add project pins" on public.feedback_pins;
create policy "Clients add project pins" on public.feedback_pins
  for insert to authenticated
  with check (
    (select private.can_access_project(
      (select rr.project_id from public.revision_rounds rr where rr.id = feedback_pins.round_id)
    ))
  );

-- Change orders: admins manage; clients read their own projects' rows.
drop policy if exists "Admins manage change orders" on public.change_orders;
create policy "Admins manage change orders" on public.change_orders
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own project change orders" on public.change_orders;
create policy "Clients read own project change orders" on public.change_orders
  for select to authenticated
  using ((select private.can_access_project(project_id)));

-- Seed the automation registry with the change-order watch (disabled by
-- default — nothing runs without Hailey's explicit kill-switch flip).
insert into public.automations (key, name, description, kind, enabled, config)
values
  ('change_order_watch', 'Change order watch',
   'Notifies when change orders sit in proposed status past the threshold (Phase 9 revision control).',
   'internal', false, '{"proposed_days": 3}'::jsonb)
on conflict (key) do nothing;
