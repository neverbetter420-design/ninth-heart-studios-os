-- Muse Project Guide PG-02: additive persistence for approval-bound roadmap drafts.
-- REVIEW ONLY: Do not apply to production until security and migration tests pass.
-- Reuses public.projects, public.tasks and public.milestones. Never touches client approvals.

alter table public.projects add column if not exists muse_revision bigint not null default 0;
-- Generated internal phases must not appear in the client portal by default.
alter table public.milestones add column if not exists muse_internal boolean not null default false;
drop policy if exists "Clients read own project milestones" on public.milestones;
create policy "Clients read own project milestones" on public.milestones
  for select to authenticated using (not muse_internal and (select private.can_access_project(project_id)));
alter table public.tasks add column if not exists muse_phase_id uuid;
alter table public.tasks add column if not exists muse_position integer;
alter table public.tasks add column if not exists muse_description text;
alter table public.tasks add column if not exists muse_estimated_minutes integer;
alter table public.tasks add column if not exists muse_completion_criteria jsonb not null default '[]'::jsonb;
alter table public.tasks add constraint muse_tasks_estimate_nonnegative check (muse_estimated_minutes is null or muse_estimated_minutes >= 0);
alter table public.tasks add constraint muse_tasks_position_nonnegative check (muse_position is null or muse_position >= 0);
alter table public.tasks add constraint muse_tasks_criteria_array check (jsonb_typeof(muse_completion_criteria) = 'array');

-- Composite keys prevent tasks, phases and subtasks from crossing projects.
create unique index if not exists muse_tasks_id_project_key on public.tasks (id, project_id);
create unique index if not exists muse_milestones_id_project_key on public.milestones (id, project_id);
alter table public.tasks add constraint muse_task_phase_same_project
  foreign key (muse_phase_id, project_id) references public.milestones(id, project_id) on delete restrict;

create table if not exists public.muse_project_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  plan jsonb not null,
  plan_version integer not null default 1 check (plan_version >= 1),
  base_project_revision bigint not null check (base_project_revision >= 0),
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','applying','applied','rejected','expired','conflicted')),
  approved_version integer,
  approved_hash text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(plan) = 'object'),
  check (approved_version is null or approved_version >= 1),
  check (status not in ('approved','applying','applied') or
    (approved_version = plan_version and approved_hash is not null and approved_by is not null and approved_at is not null))
);

create table if not exists public.muse_project_plan_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.muse_project_plan_drafts(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in ('created','edited','submitted','approved','rejected','applying','applied','conflicted','expired','failed')),
  plan_version integer not null,
  payload_hash text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.muse_project_subtasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  task_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  instructions text not null default '',
  position integer not null check (position >= 0),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','complete','blocked','cancelled')),
  completion_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(completion_criteria) = 'array'),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, project_id) references public.tasks(id, project_id) on delete cascade,
  unique (task_id, position)
);

create table if not exists public.muse_task_dependencies (
  project_id uuid not null,
  task_id uuid not null,
  depends_on_task_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id),
  foreign key (task_id, project_id) references public.tasks(id, project_id) on delete cascade,
  foreign key (depends_on_task_id, project_id) references public.tasks(id, project_id) on delete cascade
);

create index if not exists muse_drafts_project_idx on public.muse_project_plan_drafts(project_id, created_at desc);
create index if not exists muse_events_draft_idx on public.muse_project_plan_events(draft_id, created_at);
create index if not exists muse_subtasks_project_idx on public.muse_project_subtasks(project_id, task_id);
create index if not exists muse_deps_predecessor_idx on public.muse_task_dependencies(depends_on_task_id, project_id);
create index if not exists muse_tasks_phase_idx on public.tasks(muse_phase_id, muse_position);

-- Existing client task visibility remains unchanged. New Muse-only tables are admin-only.
alter table public.muse_project_plan_drafts enable row level security;
alter table public.muse_project_plan_events enable row level security;
alter table public.muse_project_subtasks enable row level security;
alter table public.muse_task_dependencies enable row level security;

create policy "Admins read Muse project drafts" on public.muse_project_plan_drafts
  for select to authenticated using ((select private.is_admin()));
create policy "Admins read Muse project events" on public.muse_project_plan_events
  for select to authenticated using ((select private.is_admin()));
create policy "Admins manage Muse subtasks" on public.muse_project_subtasks
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage Muse dependencies" on public.muse_task_dependencies
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.muse_project_plan_drafts, public.muse_project_plan_events,
  public.muse_project_subtasks, public.muse_task_dependencies from public, anon, authenticated;
grant select on public.muse_project_plan_drafts, public.muse_project_plan_events to authenticated;
grant select, insert, update, delete on public.muse_project_subtasks, public.muse_task_dependencies to authenticated;

-- A plan becomes stale when another actor modifies the project, tasks or milestones.
create or replace function private.muse_bump_project_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.projects set muse_revision = muse_revision + 1 where id = old.project_id;
    return old;
  end if;
  update public.projects set muse_revision = muse_revision + 1 where id = new.project_id;
  if tg_op = 'UPDATE' and old.project_id is distinct from new.project_id then
    update public.projects set muse_revision = muse_revision + 1 where id = old.project_id;
  end if;
  return new;
end; $$;
revoke all on function private.muse_bump_project_revision() from public, anon, authenticated;

create trigger muse_task_revision after insert or update or delete on public.tasks
  for each row execute function private.muse_bump_project_revision();
create trigger muse_milestone_revision after insert or update or delete on public.milestones
  for each row execute function private.muse_bump_project_revision();
create trigger muse_subtask_revision after insert or update or delete on public.muse_project_subtasks
  for each row execute function private.muse_bump_project_revision();
create trigger muse_dependency_revision after insert or update or delete on public.muse_task_dependencies
  for each row execute function private.muse_bump_project_revision();

create or replace function private.muse_bump_project_fields_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.muse_revision := old.muse_revision + 1;
  return new;
end; $$;
revoke all on function private.muse_bump_project_fields_revision() from public, anon, authenticated;
create trigger muse_project_fields_revision
  before update of client_id, name, status, progress, due_date, internal_notes on public.projects
  for each row execute function private.muse_bump_project_fields_revision();

-- Fails closed on cyclic or cross-project task dependency edits, not only AI-generated drafts.
create or replace function private.muse_check_dependency_cycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cycle_found boolean;
begin
  -- Serialize dependency graph edits per project, including concurrent inserts.
  perform 1 from public.projects where id = new.project_id for update;
  with recursive paths(node, trail) as (
    select new.depends_on_task_id, array[new.task_id, new.depends_on_task_id]::uuid[]
    union all
    select d.depends_on_task_id, p.trail || d.depends_on_task_id
    from paths p
    join public.muse_task_dependencies d on d.task_id = p.node
    where d.project_id = new.project_id and not (d.depends_on_task_id = any(p.trail))
  )
  select exists(
    select 1 from paths p
    join public.muse_task_dependencies d on d.task_id = p.node
    where d.project_id = new.project_id and d.depends_on_task_id = new.task_id
  ) into cycle_found;
  if cycle_found then raise exception 'Muse dependency cycle detected' using errcode = '23514'; end if;
  return new;
end; $$;
revoke all on function private.muse_check_dependency_cycle() from public, anon, authenticated;
create trigger muse_dependency_no_cycles before insert or update on public.muse_task_dependencies
  for each row execute function private.muse_check_dependency_cycle();
