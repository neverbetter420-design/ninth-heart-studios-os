-- Muse Project Guide PG-02: admin-only, approval-bound draft workflow.
-- Draft persistence and approval only. NO live project task application in this migration.
-- Security-definer RPCs perform role checks from profiles, not browser claims.
create or replace function private.muse_validate_plan_v1(
  p_plan jsonb, p_project_id uuid, p_base_revision bigint
) returns void language plpgsql set search_path = '' as $$
declare
  ph jsonb; tk jsonb; st jsonb; dep text;
  ids text[] := '{}'; task_ids text[] := '{}';
  phase_positions integer[] := '{}'; task_positions integer[]; sub_positions integer[];
  total_tasks integer := 0; total_subtasks integer := 0; has_cycle boolean;
begin
  if jsonb_typeof(p_plan) is distinct from 'object'
    or p_plan->>'schemaVersion' is distinct from '1.0'
    or p_plan->>'projectId' is distinct from p_project_id::text
    or p_plan->>'projectRevision' is distinct from p_base_revision::text
    or jsonb_typeof(p_plan->'phases') is distinct from 'array'
    or jsonb_array_length(p_plan->'phases') not between 1 and 12
    or jsonb_typeof(p_plan->'warnings') is distinct from 'array' then
    raise exception 'Invalid Muse plan envelope' using errcode = '22023';
  end if;

  for ph in select value from jsonb_array_elements(p_plan->'phases') loop
    if jsonb_typeof(ph) is distinct from 'object'
      or nullif(btrim(ph->>'title'), '') is null
      or nullif(btrim(ph->>'tempId'), '') is null
      or (ph->>'tempId') = any(ids)
      or (ph->>'position') !~ '^[0-9]{1,5}$'
      or (ph->>'position')::integer = any(phase_positions)
      or jsonb_typeof(ph->'tasks') is distinct from 'array' then
      raise exception 'Invalid Muse plan phase' using errcode = '22023';
    end if;
    ids := array_append(ids, ph->>'tempId');
    phase_positions := array_append(phase_positions, (ph->>'position')::integer);
    task_positions := '{}';
    for tk in select value from jsonb_array_elements(ph->'tasks') loop
      total_tasks := total_tasks + 1;
      if total_tasks > 250
        or jsonb_typeof(tk) is distinct from 'object'
        or nullif(btrim(tk->>'tempId'), '') is null
        or nullif(btrim(tk->>'title'), '') is null
        or (tk->>'tempId') = any(ids)
        or (tk->>'position') !~ '^[0-9]{1,5}$'
        or (tk->>'position')::integer = any(task_positions)
        or (tk->>'priority') not in ('low','normal','high','urgent')
        or jsonb_typeof(tk->'completionCriteria') is distinct from 'array'
        or jsonb_typeof(tk->'dependsOn') is distinct from 'array'
        or jsonb_typeof(tk->'subtasks') is distinct from 'array' then
        raise exception 'Invalid Muse plan task' using errcode = '22023';
      end if;
      if tk->'estimatedMinutes' is not null and tk->'estimatedMinutes' <> 'null'::jsonb
        and (tk->>'estimatedMinutes') !~ '^[0-9]{1,8}$' then
        raise exception 'Invalid estimated minutes' using errcode = '22023';
      end if;
      ids := array_append(ids, tk->>'tempId');
      task_ids := array_append(task_ids, tk->>'tempId');
      task_positions := array_append(task_positions, (tk->>'position')::integer);
      sub_positions := '{}';
      for st in select value from jsonb_array_elements(tk->'subtasks') loop
        total_subtasks := total_subtasks + 1;
        if total_subtasks > 1500
          or jsonb_typeof(st) is distinct from 'object'
          or nullif(btrim(st->>'tempId'), '') is null
          or nullif(btrim(st->>'title'), '') is null
          or (st->>'tempId') = any(ids)
          or (st->>'position') !~ '^[0-9]{1,5}$'
          or (st->>'position')::integer = any(sub_positions)
          or jsonb_typeof(st->'completionCriteria') is distinct from 'array' then
          raise exception 'Invalid Muse subtask' using errcode = '22023';
        end if;
        ids := array_append(ids, st->>'tempId');
        sub_positions := array_append(sub_positions, (st->>'position')::integer);
      end loop;
    end loop;
  end loop;
  if total_tasks < 1 then raise exception 'Plan has no tasks' using errcode = '22023'; end if;
  for dep in
    select d.value from jsonb_array_elements(p_plan->'phases') ph
    cross join lateral jsonb_array_elements(ph.value->'tasks') tk
    cross join lateral jsonb_array_elements_text(tk.value->'dependsOn') d
  loop
    if not (dep = any(task_ids)) then
      raise exception 'Unknown dependency in Muse plan' using errcode = '22023';
    end if;
  end loop;
  with recursive edges as (
    select tk.value->>'tempId' as task_id, dep.value as dep_id
    from jsonb_array_elements(p_plan->'phases') ph
    cross join lateral jsonb_array_elements(ph.value->'tasks') tk
    cross join lateral jsonb_array_elements_text(tk.value->'dependsOn') dep
  ), walk(task_id, dep_id, trail, cyclic) as (
    select e.task_id, e.dep_id, array[e.task_id,e.dep_id], e.task_id = e.dep_id from edges e
    union all
    select w.task_id, e.dep_id, w.trail || e.dep_id, e.dep_id = any(w.trail)
    from walk w join edges e on e.task_id = w.dep_id
    where not w.cyclic
  )
  select coalesce(bool_or(cyclic),false) into has_cycle from walk;
  if has_cycle then raise exception 'Muse plan dependency cycle' using errcode = '22023'; end if;
end; $$;
revoke all on function private.muse_validate_plan_v1(jsonb,uuid,bigint) from public, anon, authenticated;

create or replace function public.muse_create_project_plan(p_project_id uuid, p_plan jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_revision bigint; v_id uuid;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select muse_revision into v_revision from public.projects where id = p_project_id for share;
  if not found then raise exception 'Project not found' using errcode = '22023'; end if;
  perform private.muse_validate_plan_v1(p_plan, p_project_id, v_revision);
  insert into public.muse_project_plan_drafts (project_id, created_by, plan, base_project_revision)
    values (p_project_id, auth.uid(), p_plan, v_revision) returning id into v_id;
  insert into public.muse_project_plan_events(draft_id,actor_id,event_type,plan_version)
    values (v_id,auth.uid(),'created',1);
  return v_id;
end; $$;

create or replace function public.muse_edit_project_plan(p_draft_id uuid, p_expected_version integer, p_plan jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare d public.muse_project_plan_drafts%rowtype; v_new integer;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select * into d from public.muse_project_plan_drafts where id = p_draft_id for update;
  if not found or d.status <> 'draft' or d.plan_version <> p_expected_version then
    raise exception 'Draft unavailable or version conflict' using errcode = '40001';
  end if;
  perform private.muse_validate_plan_v1(p_plan, d.project_id, d.base_project_revision);
  v_new := d.plan_version + 1;
  update public.muse_project_plan_drafts
  set plan=p_plan, plan_version=v_new, updated_at=now()
  where id=p_draft_id;
  insert into public.muse_project_plan_events(draft_id,actor_id,event_type,plan_version)
    values (p_draft_id,auth.uid(),'edited',v_new);
  return v_new;
end; $$;

create or replace function public.muse_submit_project_plan(p_draft_id uuid, p_expected_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.muse_project_plan_drafts%rowtype; v_revision bigint;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select * into d from public.muse_project_plan_drafts where id=p_draft_id for update;
  if not found or d.status <> 'draft' or d.plan_version <> p_expected_version then
    raise exception 'Draft unavailable or version conflict' using errcode = '40001';
  end if;
  select muse_revision into v_revision from public.projects where id=d.project_id for share;
  if v_revision is distinct from d.base_project_revision then
    raise exception 'Project changed; regenerate plan' using errcode = '40001';
  end if;
  perform private.muse_validate_plan_v1(d.plan,d.project_id,d.base_project_revision);
  update public.muse_project_plan_drafts set status='pending_approval',updated_at=now() where id=p_draft_id;
  insert into public.muse_project_plan_events(draft_id,actor_id,event_type,plan_version)
    values (p_draft_id,auth.uid(),'submitted',d.plan_version);
end; $$;

create or replace function public.muse_approve_project_plan(p_draft_id uuid, p_expected_version integer, p_expected_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare d public.muse_project_plan_drafts%rowtype; v_revision bigint; v_hash text;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select * into d from public.muse_project_plan_drafts where id=p_draft_id for update;
  if not found or d.status <> 'pending_approval' or d.plan_version <> p_expected_version then
    raise exception 'Draft unavailable or version conflict' using errcode = '40001';
  end if;
  select muse_revision into v_revision from public.projects where id=d.project_id for share;
  if v_revision is distinct from d.base_project_revision then
    raise exception 'Project changed; regenerate plan' using errcode = '40001';
  end if;
  perform private.muse_validate_plan_v1(d.plan,d.project_id,d.base_project_revision);
  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.plan::text,'UTF8')),'hex');
  if p_expected_hash is distinct from v_hash then
    raise exception 'Plan review digest mismatch' using errcode = '40001';
  end if;
  update public.muse_project_plan_drafts set
    status='approved', approved_version=d.plan_version, approved_hash=v_hash,
    approved_by=auth.uid(), approved_at=now(), expires_at=now()+interval '7 days',
    updated_at=now() where id=p_draft_id;
  insert into public.muse_project_plan_events(draft_id,actor_id,event_type,plan_version,payload_hash)
    values (p_draft_id,auth.uid(),'approved',d.plan_version,v_hash);
  return v_hash;
end; $$;

create or replace function public.muse_reject_project_plan(p_draft_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d public.muse_project_plan_drafts%rowtype;
begin
  if not private.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  select * into d from public.muse_project_plan_drafts where id=p_draft_id for update;
  if not found or d.status not in ('draft','pending_approval','approved') then
    raise exception 'Draft cannot be rejected' using errcode = '40001';
  end if;
  update public.muse_project_plan_drafts set status='rejected',updated_at=now() where id=p_draft_id;
  insert into public.muse_project_plan_events(draft_id,actor_id,event_type,plan_version)
    values (p_draft_id,auth.uid(),'rejected',d.plan_version);
end; $$;

revoke all on function public.muse_create_project_plan(uuid,jsonb),
  public.muse_edit_project_plan(uuid,integer,jsonb),
  public.muse_submit_project_plan(uuid,integer),
  public.muse_approve_project_plan(uuid,integer,text),
  public.muse_reject_project_plan(uuid) from public,anon;
grant execute on function public.muse_create_project_plan(uuid,jsonb),
  public.muse_edit_project_plan(uuid,integer,jsonb),
  public.muse_submit_project_plan(uuid,integer),
  public.muse_approve_project_plan(uuid,integer,text),
  public.muse_reject_project_plan(uuid) to authenticated;
