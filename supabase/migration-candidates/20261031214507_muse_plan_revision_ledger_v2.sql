-- Muse Project Guide v2: owner-bound immutable revisions and exact-version approval.
-- SOURCE-ONLY. No production changes, no provider calls, no outreach.
-- Postgres changes must be tested against disposable local Supabase before any approval.

alter table public.muse_project_plans
  add column if not exists current_revision integer not null default 1;
alter table public.muse_project_plans
  add constraint muse_project_plans_revision_bounds check (current_revision between 1 and 25);

-- Validate independently of the TypeScript parser. RPC callers and table
-- inserts cannot bypass these limits by sending hand-crafted JSON.
create or replace function private.validate_muse_plan_task(item jsonb, is_parent boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  keys text[] := array['title','description','definition_of_done','priority','due_date','estimated_minutes','client_visible'];
  val text;
  n integer;
begin
  if jsonb_typeof(item) is distinct from 'object' then
    raise exception 'Invalid Muse task object.';
  end if;
  if is_parent then keys := keys || 'subtasks'; end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(item)) <> pg_catalog.array_length(keys, 1)
     or exists (select 1 from pg_catalog.jsonb_object_keys(item) k
                where not (k = any(keys)))
     or not (item ?& keys) then
    raise exception 'Muse task fields are missing or unexpected.';
  end if;
  if jsonb_typeof(item->'title') <> 'string'
     or char_length(pg_catalog.btrim(item->>'title')) not between 2 and 160
     or jsonb_typeof(item->'description') <> 'string'
     or char_length(pg_catalog.btrim(item->>'description')) not between 2 and 1200
     or jsonb_typeof(item->'definition_of_done') <> 'string'
     or char_length(pg_catalog.btrim(item->>'definition_of_done')) not between 2 and 600
     or jsonb_typeof(item->'priority') <> 'string'
     or item->>'priority' not in ('low','normal','high')
     or jsonb_typeof(item->'client_visible') <> 'boolean' then
    raise exception 'Muse task fields are invalid.';
  end if;
  if item->'due_date' <> 'null'::jsonb then
    if jsonb_typeof(item->'due_date') <> 'string'
       or item->>'due_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Muse task due date is invalid.';
    end if;
    val := item->>'due_date';
    if pg_catalog.to_char(val::date, 'YYYY-MM-DD') <> val then
      raise exception 'Muse task due date is invalid.';
    end if;
  end if;
  if item->'estimated_minutes' <> 'null'::jsonb then
    val := item->>'estimated_minutes';
    if jsonb_typeof(item->'estimated_minutes') <> 'number'
       or val !~ '^[0-9]{1,4}$' then
      raise exception 'Muse task estimate is invalid.';
    end if;
    n := val::integer;
    if n not between 5 and 1440 then
      raise exception 'Muse task estimate is out of range.';
    end if;
  end if;
end;
$$;

create or replace function private.validate_muse_project_plan(input_plan jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  p jsonb;
  c jsonb;
  total integer := 0;
begin
  if jsonb_typeof(input_plan) is distinct from 'object' then
    raise exception 'Invalid Muse plan.';
  end if;
  if (select count(*) from pg_catalog.jsonb_object_keys(input_plan)) <> 2
     or not (input_plan ?& array['summary','tasks'])
     or jsonb_typeof(input_plan->'summary') <> 'string'
     or char_length(pg_catalog.btrim(input_plan->>'summary')) not between 2 and 800
     or jsonb_typeof(input_plan->'tasks') <> 'array'
     or jsonb_array_length(input_plan->'tasks') not between 1 and 12 then
    raise exception 'Muse plan summary or task array invalid.';
  end if;
  for p in select value from pg_catalog.jsonb_array_elements(input_plan->'tasks') loop
    perform private.validate_muse_plan_task(p, true);
    if jsonb_typeof(p->'subtasks') <> 'array'
       or jsonb_array_length(p->'subtasks') > 8 then
      raise exception 'Muse plan exceeds subtask limit.';
    end if;
    total := total + 1;
    for c in select value from pg_catalog.jsonb_array_elements(p->'subtasks') loop
      perform private.validate_muse_plan_task(c, false);
      total := total + 1;
      if total > 48 then
        raise exception 'Muse plan exceeds 48 tasks.';
      end if;
    end loop;
  end loop;
  return total;
end;
$$;

create table public.muse_project_plan_revisions (
  plan_id uuid not null references public.muse_project_plans(id) on delete cascade,
  revision integer not null check (revision between 1 and 25),
  plan jsonb not null,
  change_summary text not null check (char_length(change_summary) between 2 and 250),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(plan_id, revision)
);
create index idx_muse_project_plan_revisions_owner
  on public.muse_project_plan_revisions(created_by, created_at desc);
alter table public.muse_project_plan_revisions enable row level security;
create policy "Owner admins read Muse plan history" on public.muse_project_plan_revisions
  for select to authenticated
  using ((select private.is_admin()) and created_by = (select auth.uid())
    and exists (select 1 from public.muse_project_plans p
                where p.id = plan_id and p.created_by = (select auth.uid())));
revoke all on table public.muse_project_plan_revisions from public, anon, authenticated;
grant select on table public.muse_project_plan_revisions to authenticated;

-- Data API never grants direct UPDATE or DELETE on plans after this migration.
-- The read/insert policies are owner-only; a newly inserted proposal is draft.
drop policy if exists "Admins manage own Muse project plans" on public.muse_project_plans;
create policy "Owner admins read Muse plans" on public.muse_project_plans
  for select to authenticated
  using ((select private.is_admin()) and created_by = (select auth.uid()));
create policy "Owner admins insert draft Muse plans" on public.muse_project_plans
  for insert to authenticated
  with check ((select private.is_admin())
    and created_by = (select auth.uid())
    and status = 'draft' and current_revision = 1
    and approved_at is null and applied_at is null
    and expires_at > now() and expires_at <= now() + interval '24 hours 1 minute');
revoke all on table public.muse_project_plans from public, anon, authenticated;
grant select, insert on table public.muse_project_plans to authenticated;

-- Backfill the full immutable original before applying any draft changes.
insert into public.muse_project_plan_revisions
  (plan_id, revision, plan, change_summary, created_by, created_at)
select p.id, 1, p.plan, 'Original proposal', p.created_by, p.created_at
from public.muse_project_plans p;
-- Existing data must satisfy the upgraded contract, otherwise migration aborts.
do $$
declare row_value record;
begin
  for row_value in select id, plan from public.muse_project_plans loop
    perform private.validate_muse_project_plan(row_value.plan);
  end loop;
end;
$$;

-- Only a database-owned trigger can insert the first snapshot. Client requests
-- cannot insert revision rows directly.
create or replace function private.capture_initial_muse_plan_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin())
     or new.created_by is distinct from (select auth.uid())
     or new.status <> 'draft' or new.current_revision <> 1
     or new.summary <> new.plan->>'summary' then
    raise exception 'Muse draft must be owned, valid, and unapproved.';
  end if;
  perform private.validate_muse_project_plan(new.plan);
  insert into public.muse_project_plan_revisions
    (plan_id,revision,plan,change_summary,created_by)
  values (new.id,1,new.plan,'Original proposal',new.created_by);
  return new;
end;
$$;
revoke all on function private.capture_initial_muse_plan_revision() from public, anon, authenticated;
drop trigger if exists capture_initial_muse_plan_revision on public.muse_project_plans;
create trigger capture_initial_muse_plan_revision
  after insert on public.muse_project_plans
  for each row execute function private.capture_initial_muse_plan_revision();

-- Private SECURITY DEFINER is necessary for atomic ledger writes after
-- revoking client-visible UPDATE/DELETE/INSERT privileges. Explicit auth and
-- owner checks below, fixed search_path and no dynamic SQL are mandatory.
create or replace function private.save_muse_plan_revision_internal(
  target_plan_id uuid, target_project_id uuid, expected_revision integer,
  updated_plan jsonb, change_note text
)
returns table(saved_plan_id uuid, saved_project_id uuid, saved_revision integer, saved_plan jsonb, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  old_row public.muse_project_plans%rowtype;
  next_revision integer;
begin
  if (select auth.uid()) is null or not (select private.is_admin()) then
    raise exception 'Admin access required.';
  end if;
  if expected_revision is null or expected_revision not between 1 and 24
     or char_length(pg_catalog.btrim(change_note)) not between 2 and 250 then
    raise exception 'Invalid revision request.';
  end if;
  select * into old_row from public.muse_project_plans p
   where p.id = target_plan_id and p.project_id = target_project_id
     and p.created_by = (select auth.uid()) and p.status = 'draft'
   for update;
  if not found or old_row.expires_at <= now() then
    raise exception 'Muse draft is unavailable or expired.';
  end if;
  if old_row.current_revision <> expected_revision then
    raise exception 'Revision conflict. Reload the saved plan.';
  end if;
  if not exists (
     select 1 from public.muse_project_plan_revisions r
     where r.plan_id = old_row.id and r.revision = old_row.current_revision
       and r.plan = old_row.plan and r.created_by = old_row.created_by
  ) then
    raise exception 'Revision ledger does not match current plan.';
  end if;
  perform private.validate_muse_project_plan(updated_plan);
  if updated_plan = old_row.plan then
    raise exception 'Muse plan is unchanged.';
  end if;
  next_revision := old_row.current_revision + 1;
  insert into public.muse_project_plan_revisions
    (plan_id,revision,plan,change_summary,created_by)
  values (old_row.id,next_revision,updated_plan,change_note,old_row.created_by);
  update public.muse_project_plans
     set plan = updated_plan, summary = updated_plan->>'summary',
         current_revision = next_revision, updated_at = now()
   where id = old_row.id;
  return query select old_row.id, old_row.project_id, next_revision,
                      updated_plan, old_row.expires_at;
end;
$$;

-- The original publicly callable one-argument apply function is removed.
-- A stale tab cannot fall back to the unsafe, non-revision-bound signature.
revoke all on function public.apply_muse_project_plan(uuid) from public, anon, authenticated;
drop function public.apply_muse_project_plan(uuid);

-- Port v1's atomic task creation exactly, but tie it to project, revision,
-- immutable snapshot and expected count under the same row lock.
create or replace function private.apply_muse_plan_revision_internal(
  target_plan_id uuid, target_project_id uuid, expected_revision integer, expected_count integer
)
returns table(applied_plan_id uuid, applied_project_id uuid, applied_revision integer, created_count integer)
language plpgsql security definer set search_path = '' as $$
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
    raise exception 'Muse plan expired. Generate a fresh plan.';
  end if;
  if saved.project_id is distinct from target_project_id then
    raise exception 'Project does not match approved plan.';
  end if;
  if expected_revision is null or saved.current_revision <> expected_revision then
    raise exception 'Revision conflict. Reload the saved plan.';
  end if;
  if expected_count is null or expected_count not between 1 and 48 then
    raise exception 'Invalid approved task count.';
  end if;
  if not exists (
    select 1 from public.muse_project_plan_revisions r
    where r.plan_id = saved.id and r.revision = saved.current_revision
      and r.plan = saved.plan and r.created_by = saved.created_by
  ) then
    raise exception 'Plan ledger mismatch. Approval is blocked.';
  end if;
  if private.validate_muse_project_plan(saved.plan) <> expected_count then
    raise exception 'Plan task count changed. Review again.';
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

  if total_created <> expected_count then
    raise exception 'The approved task count differs from created tasks.';
  end if;

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
    jsonb_build_object('muse_plan_id', saved.id, 'created_count', total_created, 'applied_revision', saved.current_revision)
  );

  return query select saved.id, saved.project_id, saved.current_revision, total_created;
end;
$$;

-- API-visible entrypoints run as the caller; private inner functions are NOT
-- exposed in PostgREST's public schema and verify owner/auth again.
create or replace function public.save_muse_project_plan_revision(
  target_plan_id uuid, target_project_id uuid, expected_revision integer,
  updated_plan jsonb, change_note text
)
returns table(saved_plan_id uuid, saved_project_id uuid, saved_revision integer, saved_plan jsonb, expires_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from private.save_muse_plan_revision_internal(
    target_plan_id, target_project_id, expected_revision, updated_plan, change_note
  );
$$;

create or replace function public.apply_muse_project_plan(
  target_plan_id uuid, target_project_id uuid, expected_revision integer, expected_count integer
)
returns table(applied_plan_id uuid, applied_project_id uuid, applied_revision integer, created_count integer)
language sql security invoker set search_path = '' as $$
  select * from private.apply_muse_plan_revision_internal(
    target_plan_id, target_project_id, expected_revision, expected_count
  );
$$;

revoke all on function private.validate_muse_plan_task(jsonb,boolean) from public, anon;
revoke all on function private.validate_muse_project_plan(jsonb) from public, anon;
revoke all on function private.save_muse_plan_revision_internal(uuid,uuid,integer,jsonb,text) from public, anon;
revoke all on function private.apply_muse_plan_revision_internal(uuid,uuid,integer,integer) from public, anon;
grant execute on function private.save_muse_plan_revision_internal(uuid,uuid,integer,jsonb,text) to authenticated;
grant execute on function private.apply_muse_plan_revision_internal(uuid,uuid,integer,integer) to authenticated;
revoke all on function public.save_muse_project_plan_revision(uuid,uuid,integer,jsonb,text) from public, anon;
revoke all on function public.apply_muse_project_plan(uuid,uuid,integer,integer) from public, anon;
grant execute on function public.save_muse_project_plan_revision(uuid,uuid,integer,jsonb,text) to authenticated;
grant execute on function public.apply_muse_project_plan(uuid,uuid,integer,integer) to authenticated;
