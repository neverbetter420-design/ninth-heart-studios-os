-- Muse Project Guide v1
--
-- Adds one-level task/subtask structure and a private, owner-bound plan ledger.
-- A plan is only a proposal until the authenticated admin explicitly applies
-- that exact stored version through apply_muse_project_plan().

create table if not exists public.muse_project_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  objective text not null check (char_length(objective) between 2 and 500),
  summary text not null check (char_length(summary) between 2 and 800),
  plan jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'applied', 'rejected', 'expired')),
  source_model text not null check (char_length(source_model) between 2 and 80),
  evidence_checked_at timestamptz not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    jsonb_typeof(plan) = 'object'
    and plan ? 'tasks'
    and jsonb_typeof(plan -> 'tasks') = 'array'
    and jsonb_array_length(plan -> 'tasks') between 1 and 12
  ),
  check (
    (status = 'applied' and approved_at is not null and applied_at is not null)
    or (status <> 'applied' and applied_at is null)
  )
);

create index if not exists idx_muse_project_plans_owner_status
  on public.muse_project_plans(created_by, status, created_at desc);
create index if not exists idx_muse_project_plans_project
  on public.muse_project_plans(project_id, created_at desc);

alter table public.muse_project_plans enable row level security;

drop policy if exists "Admins manage own Muse project plans" on public.muse_project_plans;
create policy "Admins manage own Muse project plans"
  on public.muse_project_plans
  for all
  to authenticated
  using (
    (select private.is_admin())
    and created_by = (select auth.uid())
  )
  with check (
    (select private.is_admin())
    and created_by = (select auth.uid())
  );

-- Supabase no longer guarantees automatic Data API exposure for new tables.
revoke all on table public.muse_project_plans from public, anon;
grant select, insert, update, delete on table public.muse_project_plans to authenticated;

alter table public.tasks
  add column if not exists parent_task_id uuid,
  add column if not exists description text,
  add column if not exists definition_of_done text,
  add column if not exists position integer not null default 0,
  add column if not exists estimated_minutes integer,
  add column if not exists source text not null default 'manual',
  add column if not exists muse_plan_id uuid references public.muse_project_plans(id) on delete set null;

alter table public.tasks
  drop constraint if exists tasks_parent_not_self,
  add constraint tasks_parent_not_self
    check (parent_task_id is null or parent_task_id <> id),
  drop constraint if exists tasks_position_bounds,
  add constraint tasks_position_bounds
    check (position between 0 and 10000),
  drop constraint if exists tasks_estimated_minutes_bounds,
  add constraint tasks_estimated_minutes_bounds
    check (estimated_minutes is null or estimated_minutes between 5 and 1440),
  drop constraint if exists tasks_source_values,
  add constraint tasks_source_values
    check (source in ('manual', 'muse'));

alter table public.tasks
  drop constraint if exists tasks_id_project_unique,
  add constraint tasks_id_project_unique unique (id, project_id);

alter table public.tasks
  drop constraint if exists tasks_parent_same_project_fk,
  add constraint tasks_parent_same_project_fk
    foreign key (parent_task_id, project_id)
    references public.tasks(id, project_id)
    on delete restrict;

create index if not exists idx_tasks_project_parent_position
  on public.tasks(project_id, parent_task_id, position, created_at);
create index if not exists idx_tasks_muse_plan_id
  on public.tasks(muse_plan_id)
  where muse_plan_id is not null;

-- The first guide release intentionally supports one parent + one subtask
-- level. That stays readable on a phone and prevents accidental task mazes.
create or replace function private.enforce_muse_task_depth()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  parent_parent_id uuid;
begin
  if new.parent_task_id is null then
    return new;
  end if;

  select t.parent_task_id
    into parent_parent_id
    from public.tasks t
   where t.id = new.parent_task_id
     and t.project_id = new.project_id;

  if not found then
    raise exception 'Parent task must exist in the same project.';
  end if;
  if parent_parent_id is not null then
    raise exception 'Muse Project Guide supports one subtask level.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_muse_task_depth() from public, anon;
grant execute on function private.enforce_muse_task_depth() to authenticated, service_role;

drop trigger if exists enforce_muse_task_depth on public.tasks;
create trigger enforce_muse_task_depth
before insert or update of parent_task_id, project_id
on public.tasks
for each row execute function private.enforce_muse_task_depth();

-- Applies a previously stored proposal atomically. The database re-validates
-- every bounded field; a malformed or stale plan creates nothing.
create or replace function public.apply_muse_project_plan(target_plan_id uuid)
returns table(applied_plan_id uuid, applied_project_id uuid, created_count integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  saved public.muse_project_plans%rowtype;
  parent_item jsonb;
  child_item jsonb;
  parent_id uuid;
  parent_number integer := 0;
  child_number integer := 0;
  total_created integer := 0;
  due_date_value date;
  estimate_value integer;
begin
  if not (select private.is_admin()) then
    raise exception 'Admin access required.';
  end if;

  select *
    into saved
    from public.muse_project_plans p
   where p.id = target_plan_id
     and p.created_by = (select auth.uid())
     and p.status = 'draft'
   for update;

  if not found then
    raise exception 'Muse plan is unavailable or is no longer a draft.';
  end if;
  if saved.expires_at <= now() then
    update public.muse_project_plans
       set status = 'expired', updated_at = now()
     where id = saved.id;
    raise exception 'Muse plan expired. Generate a fresh plan.';
  end if;

  for parent_item in select value from jsonb_array_elements(saved.plan -> 'tasks') loop
    parent_number := parent_number + 1;
    if parent_number > 12
       or jsonb_typeof(parent_item) <> 'object'
       or char_length(coalesce(parent_item ->> 'title', '')) not between 2 and 160
       or char_length(coalesce(parent_item ->> 'description', '')) not between 2 and 1200
       or char_length(coalesce(parent_item ->> 'definition_of_done', '')) not between 2 and 600
       or coalesce(parent_item ->> 'priority', '') not in ('low', 'normal', 'high')
       or coalesce(jsonb_typeof(parent_item -> 'subtasks'), '') <> 'array'
       or jsonb_array_length(parent_item -> 'subtasks') > 8 then
      raise exception 'Muse plan contains an invalid parent task.';
    end if;

    due_date_value := null;
    if nullif(parent_item ->> 'due_date', '') is not null then
      due_date_value := (parent_item ->> 'due_date')::date;
    end if;
    estimate_value := null;
    if nullif(parent_item ->> 'estimated_minutes', '') is not null then
      estimate_value := (parent_item ->> 'estimated_minutes')::integer;
      if estimate_value not between 5 and 1440 then
        raise exception 'Muse plan contains an invalid time estimate.';
      end if;
    end if;

    insert into public.tasks (
      project_id, title, description, definition_of_done, status, priority,
      due_at, client_visible, position, estimated_minutes, source, muse_plan_id
    ) values (
      saved.project_id,
      parent_item ->> 'title',
      parent_item ->> 'description',
      parent_item ->> 'definition_of_done',
      'not_started',
      parent_item ->> 'priority',
      case when due_date_value is null then null else (due_date_value::text || 'T00:00:00Z')::timestamptz end,
      coalesce((parent_item ->> 'client_visible')::boolean, false),
      parent_number * 100,
      estimate_value,
      'muse',
      saved.id
    ) returning id into parent_id;
    total_created := total_created + 1;

    child_number := 0;
    for child_item in select value from jsonb_array_elements(parent_item -> 'subtasks') loop
      child_number := child_number + 1;
      if total_created >= 48
         or jsonb_typeof(child_item) <> 'object'
         or char_length(coalesce(child_item ->> 'title', '')) not between 2 and 160
         or char_length(coalesce(child_item ->> 'description', '')) not between 2 and 1200
         or char_length(coalesce(child_item ->> 'definition_of_done', '')) not between 2 and 600
         or coalesce(child_item ->> 'priority', '') not in ('low', 'normal', 'high') then
        raise exception 'Muse plan contains an invalid subtask.';
      end if;

      due_date_value := null;
      if nullif(child_item ->> 'due_date', '') is not null then
        due_date_value := (child_item ->> 'due_date')::date;
      end if;
      estimate_value := null;
      if nullif(child_item ->> 'estimated_minutes', '') is not null then
        estimate_value := (child_item ->> 'estimated_minutes')::integer;
        if estimate_value not between 5 and 1440 then
          raise exception 'Muse plan contains an invalid subtask estimate.';
        end if;
      end if;

      insert into public.tasks (
        project_id, parent_task_id, title, description, definition_of_done,
        status, priority, due_at, client_visible, position,
        estimated_minutes, source, muse_plan_id
      ) values (
        saved.project_id,
        parent_id,
        child_item ->> 'title',
        child_item ->> 'description',
        child_item ->> 'definition_of_done',
        'not_started',
        child_item ->> 'priority',
        case when due_date_value is null then null else (due_date_value::text || 'T00:00:00Z')::timestamptz end,
        coalesce((child_item ->> 'client_visible')::boolean, false),
        child_number * 10,
        estimate_value,
        'muse',
        saved.id
      );
      total_created := total_created + 1;
    end loop;
  end loop;

  update public.muse_project_plans
     set status = 'applied', approved_at = now(), applied_at = now(), updated_at = now()
   where id = saved.id;

  insert into public.activities(project_id, actor_id, event_type, summary, client_visible, metadata)
  values (
    saved.project_id,
    (select auth.uid()),
    'muse_plan_applied',
    'Muse project plan applied: ' || total_created || ' task' || case when total_created = 1 then '' else 's' end || ' created.',
    false,
    jsonb_build_object('muse_plan_id', saved.id, 'created_count', total_created)
  );

  return query select saved.id, saved.project_id, total_created;
end;
$$;

revoke all on function public.apply_muse_project_plan(uuid) from public, anon;
grant execute on function public.apply_muse_project_plan(uuid) to authenticated;
