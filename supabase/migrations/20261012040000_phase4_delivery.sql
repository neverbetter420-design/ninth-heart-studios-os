-- Phase 4 — Project Delivery
-- Adds milestones (progress markers) and launch_items (payment gates,
-- launch checklist, post-launch follow-ups) with RLS mirroring tasks.

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'not_started',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.launch_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  kind text not null default 'checklist',
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind in ('payment', 'checklist', 'followup'))
);

create index if not exists idx_milestones_project on public.milestones(project_id);
create index if not exists idx_launch_items_project on public.launch_items(project_id);

alter table public.milestones enable row level security;
alter table public.launch_items enable row level security;

-- Milestones: admins manage everything; clients read their own projects' milestones.
drop policy if exists "Admins manage milestones" on public.milestones;
create policy "Admins manage milestones" on public.milestones
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own project milestones" on public.milestones;
create policy "Clients read own project milestones" on public.milestones
  for select to authenticated
  using ((select private.can_access_project(project_id)));

-- Launch items: admins manage everything; clients read only follow-up items.
-- Payment gates and internal checklists stay admin-only.
drop policy if exists "Admins manage launch items" on public.launch_items;
create policy "Admins manage launch items" on public.launch_items
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own followup items" on public.launch_items;
create policy "Clients read own followup items" on public.launch_items
  for select to authenticated
  using (kind = 'followup' and (select private.can_access_project(project_id)));
