\set ON_ERROR_STOP on
-- Isolated workflow tests: Postgres 17, synthetic identities only.
insert into public.milestones(project_id,title,muse_internal)
 values ('11111111-1111-1111-1111-111111111111','Internal Muse phase',true);
select muse_revision as revision from public.projects
 where id='11111111-1111-1111-1111-111111111111' \gset
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with p as (
 select ('{"schemaVersion":"1.0","projectId":"11111111-1111-1111-1111-111111111111","projectRevision":0,"summary":"Fixture","warnings":[],"phases":[{"tempId":"phase01","title":"Discovery","position":0,"tasks":[{"tempId":"task01","title":"Audit","description":"Inspect site","position":0,"priority":"normal","estimatedMinutes":30,"completionCriteria":["Reviewed"],"dependsOn":[],"subtasks":[{"tempId":"sub01","title":"Review mobile","instructions":"Check viewport","position":0,"completionCriteria":["Checked"]}]}]}]}'::jsonb
   || jsonb_build_object('projectRevision', :revision::bigint)) as plan
)
select public.muse_create_project_plan('11111111-1111-1111-1111-111111111111',p.plan) as draft_id from p \gset
select public.muse_submit_project_plan(:'draft_id'::uuid,1);
select plan_digest from public.muse_review_project_plan(:'draft_id'::uuid) \gset
select public.muse_approve_project_plan(:'draft_id'::uuid,1,:'plan_digest');
do $$
begin
 if not exists(select 1 from public.muse_project_plan_drafts where status='approved' and approved_version=1 and approved_hash is not null)
 then raise exception 'Approved draft was not saved'; end if;
 if exists(select 1 from public.tasks) then raise exception 'Approving a plan created live tasks'; end if;
end $$;
-- A client cannot read a draft, approval event or internal milestone or invoke the admin review RPC.
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$
begin
 if (select count(*) from public.muse_project_plan_drafts) <> 0 then raise exception 'Client could read Muse drafts'; end if;
 if (select count(*) from public.muse_project_plan_events) <> 0 then raise exception 'Client could read Muse events'; end if;
 if (select count(*) from public.milestones where muse_internal) <> 0 then raise exception 'Client could read internal phase'; end if;
 begin
   perform public.muse_review_project_plan((select id from public.muse_project_plan_drafts limit 1));
   raise exception 'Client unexpectedly passed Muse review';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
-- Project modifications invalidate an older draft before it can be submitted.
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
with p as (
 select ('{"schemaVersion":"1.0","projectId":"11111111-1111-1111-1111-111111111111","projectRevision":0,"summary":"Stale fixture","warnings":[],"phases":[{"tempId":"phase02","title":"Discovery","position":0,"tasks":[{"tempId":"task02","title":"Audit","description":"Inspect site","position":0,"priority":"normal","estimatedMinutes":30,"completionCriteria":["Reviewed"],"dependsOn":[],"subtasks":[]}]}]}'::jsonb
   || jsonb_build_object('projectRevision', (select muse_revision from public.projects where id='11111111-1111-1111-1111-111111111111'))) as plan
)
select public.muse_create_project_plan('11111111-1111-1111-1111-111111111111',p.plan) as stale_id from p \gset
-- As authenticated admin, direct tasks insertion is intentionally allowed in real NHS OS.
reset role;
insert into public.tasks(project_id,title) values ('11111111-1111-1111-1111-111111111111','Changed independently');
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
do $$
begin
 begin
   perform public.muse_submit_project_plan((select id from public.muse_project_plan_drafts where status='draft' order by created_at desc limit 1),1);
   raise exception 'Stale draft unexpectedly submitted';
 exception when serialization_failure then null;
 end;
end $$;
reset role;
select 'muse_pg02_workflow_passed' as result;
