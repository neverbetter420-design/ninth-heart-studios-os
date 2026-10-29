-- Muse PG-02 proposed atomic apply. NOT in approved production migration inventory.
-- Supabase RPC executes in one transaction; any error rolls all inserts and status changes back.
-- All new tasks default internal; existing tasks and client approvals are never modified.
create or replace function public.muse_apply_project_plan(
  p_draft_id uuid, p_expected_version integer, p_expected_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $muse_apply$
declare
  d public.muse_project_plan_drafts%rowtype;
  revision_now bigint;
  actual_hash text;
  phase_doc jsonb;
  task_doc jsonb;
  sub_doc jsonb;
  dep_temp text;
  phase_map jsonb := '{}'::jsonb;
  task_map jsonb := '{}'::jsonb;
  phase_id uuid;
  task_id uuid;
  base_position integer;
  phase_count integer := 0;
  task_count integer := 0;
  subtask_count integer := 0;
  dep_count integer := 0;
begin
  if not private.is_admin() then
    raise exception 'Admin required' using errcode = '42501';
  end if;

  select * into d from public.muse_project_plan_drafts where id=p_draft_id for update;
  if not found then raise exception 'Muse plan draft not found' using errcode = '22023'; end if;
  if d.plan_version <> p_expected_version
    or d.approved_version is distinct from p_expected_version
    or d.approved_hash is distinct from p_expected_hash then
    raise exception 'Approval version or digest mismatch' using errcode = '40001';
  end if;
  if d.status = 'applied' then
    return pg_catalog.jsonb_build_object('status','already_applied','draftId',d.id);
  end if;
  if d.status <> 'approved' or d.expires_at is null or d.expires_at <= now() then
    raise exception 'A current approved draft is required' using errcode = '42501';
  end if;

  -- Lock the project across validation and ALL writes. Another approval cannot race.
  select muse_revision into revision_now
    from public.projects where id=d.project_id for update;
  if revision_now is distinct from d.base_project_revision then
    raise exception 'Project changed after approval' using errcode = '40001';
  end if;
  perform private.muse_validate_plan_v1(d.plan,d.project_id,d.base_project_revision);
  actual_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(d.plan::text,'UTF8')),'hex');
  if actual_hash is distinct from d.approved_hash then
    raise exception 'Approved plan was altered' using errcode = '40001';
  end if;

  -- The existing milestone list may already contain client-facing milestones.
  -- New internal Muse phases are appended, never replacing or publishing them.
  select coalesce(max(position),-1)+1 into base_position
    from public.milestones where project_id=d.project_id;

  for phase_doc in select value from pg_catalog.jsonb_array_elements(d.plan->'phases') loop
    insert into public.milestones(project_id,title,status,position,muse_internal)
    values (d.project_id,phase_doc->>'title','not_started',
      base_position+(phase_doc->>'position')::integer,true)
    returning id into phase_id;
    phase_map := pg_catalog.jsonb_set(phase_map,array[phase_doc->>'tempId'],pg_catalog.to_jsonb(phase_id::text),true);
    phase_count := phase_count+1;
    for task_doc in select value from pg_catalog.jsonb_array_elements(phase_doc->'tasks') loop
      insert into public.tasks(
        project_id,title,status,priority,client_visible,muse_phase_id,
        muse_position,muse_description,muse_estimated_minutes,muse_completion_criteria
      ) values (
        d.project_id,task_doc->>'title','not_started',task_doc->>'priority',false,phase_id,
        (task_doc->>'position')::integer,coalesce(task_doc->>'description',''),
        nullif(task_doc->>'estimatedMinutes','')::integer,
        task_doc->'completionCriteria'
      ) returning id into task_id;
      task_map := pg_catalog.jsonb_set(task_map,array[task_doc->>'tempId'],pg_catalog.to_jsonb(task_id::text),true);
      task_count := task_count+1;
      for sub_doc in select value from pg_catalog.jsonb_array_elements(task_doc->'subtasks') loop
        insert into public.muse_project_subtasks(
          project_id,task_id,title,instructions,position,completion_criteria
        ) values (
          d.project_id,task_id,sub_doc->>'title',coalesce(sub_doc->>'instructions',''),
          (sub_doc->>'position')::integer,sub_doc->'completionCriteria'
        );
        subtask_count := subtask_count+1;
      end loop;
    end loop;
  end loop;

  -- Resolve dependencies only after all referenced tasks exist.
  for phase_doc in select value from pg_catalog.jsonb_array_elements(d.plan->'phases') loop
    for task_doc in select value from pg_catalog.jsonb_array_elements(phase_doc->'tasks') loop
      for dep_temp in select value from pg_catalog.jsonb_array_elements_text(task_doc->'dependsOn') loop
        insert into public.muse_task_dependencies(project_id,task_id,depends_on_task_id)
        values (
          d.project_id,(task_map->>(task_doc->>'tempId'))::uuid,
          (task_map->>dep_temp)::uuid
        );
        dep_count := dep_count+1;
      end loop;
    end loop;
  end loop;

  update public.muse_project_plan_drafts
     set status='applied', applied_at=now(), updated_at=now()
     where id=d.id;
  insert into public.muse_project_plan_events(
    draft_id,actor_id,event_type,plan_version,payload_hash,details
  ) values (d.id,auth.uid(),'applied',d.plan_version,d.approved_hash,
    pg_catalog.jsonb_build_object(
      'phases',phase_count,'tasks',task_count,
      'subtasks',subtask_count,'dependencies',dep_count
    ));
  return pg_catalog.jsonb_build_object(
    'status','applied','draftId',d.id,'phases',phase_count,
    'tasks',task_count,'subtasks',subtask_count,'dependencies',dep_count
  );
end; $muse_apply$;
revoke all on function public.muse_apply_project_plan(uuid,integer,text) from public,anon;
grant execute on function public.muse_apply_project_plan(uuid,integer,text) to authenticated;
