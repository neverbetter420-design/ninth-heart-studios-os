-- Execute only in the ephemeral Postgres 17 CI service. DO NOT use
-- the active NHS Supabase project or any existing client/approval records.
\set ON_ERROR_STOP on
begin;
-- The function executes its query with the caller's RLS identity. A write
-- rejected by SQLSTATE 42501/22001 or that updates zero rows is a safe deny.
create function pg_temp.expect_denied(statement text, description text)
returns void language plpgsql security invoker as $function$
declare affected bigint := -1;
begin
  begin
    execute statement;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'SECURITY FAILURE: % affected % rows', description, affected;
    end if;
  exception
    when insufficient_privilege or string_data_right_truncation then return;
  end;
end
$function$;

do $$
begin
  if not exists (select 1 from pg_trigger
                 where tgrelid='public.approvals'::regclass
                   and tgname='zz_guard_client_approval_decision' and not tgisinternal)
  then raise exception 'Approval guard was not applied'; end if;
  if not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='messages'
                   and policyname='Clients send project messages'
                   and with_check like '%auth.uid%')
  then raise exception 'Client sender ownership policy was not applied'; end if;
end $$;
\echo PASS: exact migration installed in ephemeral Postgres.

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
do $$
declare own_count int; other_count int; decision_time timestamptz; title_before text;
begin
  select count(*) into own_count from public.approvals where project_id='33333333-3333-4333-8333-333333333333';
  select count(*) into other_count from public.approvals where project_id='44444444-4444-4444-8444-444444444444';
  if own_count<>3 or other_count<>0 then
    raise exception 'Client A approval read isolation failed: own %, other %',own_count,other_count;
  end if;
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id='55555555-5555-4555-8555-555555555554'$sql$,
    'Client A changes Client B approval');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title='Malicious title' where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A alters title during a decision');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    project_id='44444444-4444-4444-8444-444444444444'
    where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A reassigns approval to another client');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    requested_at='2001-01-01'
    where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A forges request timestamp');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    approval_source='client-forged'
    where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A changes an unanticipated future metadata field');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A spoofs Client B as decision owner');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    client_comment=repeat('x',281) where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A sends oversized decision comment');
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id='55555555-5555-4555-8555-555555555553'$sql$,
    'Client A tries to re-decide a completed approval');

  update public.approvals
     set status='approved', decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
         decided_at='2001-01-01 00:00:00+00',
         client_comment='Approved in isolated QA'
   where id='55555555-5555-4555-8555-555555555551'
   returning decided_at into decision_time;
  if decision_time is null or decision_time < statement_timestamp()-interval '30 seconds'
    or decision_time > statement_timestamp()+interval '30 seconds' then
    raise exception 'Database did not replace forged decision timestamp';
  end if;
  select title into title_before from public.approvals where id='55555555-5555-4555-8555-555555555551';
  if title_before <> 'Synthetic Pending A' then raise exception 'Approval title changed'; end if;
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='declined',decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client A tries to re-decide their just-approved record');

  update public.approvals set status='declined', decided_by='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    client_comment='Declined in isolated QA'
  where id='55555555-5555-4555-8555-555555555552';
  if not exists (select 1 from public.approvals where id='55555555-5555-4555-8555-555555555552'
    and status='declined' and decided_at is not null) then
    raise exception 'Legitimate client decline failed';
  end if;
end $$;
\echo PASS: client approval decisions accepted; metadata, spoofing, cross-client and re-decisions rejected.

do $$
declare messages_before int; messages_after int;
begin
  select count(*) into messages_before from public.messages;
  insert into public.messages(id,project_id,sender_id,body)
  values ('66666666-6666-4666-8666-666666666661','33333333-3333-4333-8333-333333333333',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Legitimate synthetic message');
  select count(*) into messages_after from public.messages;
  if messages_after<>messages_before+1 then raise exception 'Legitimate client message failed'; end if;
  perform pg_temp.expect_denied(
    $sql$insert into public.messages(id,project_id,sender_id,body)
      values('66666666-6666-4666-8666-666666666662','33333333-3333-4333-8333-333333333333',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Spoofed sender')$sql$,
    'Client A forges Client B sender ID');
  perform pg_temp.expect_denied(
    $sql$insert into public.messages(id,project_id,sender_id,body)
      values('66666666-6666-4666-8666-666666666663','44444444-4444-4444-8444-444444444444',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Cross-client project')$sql$,
    'Client A sends to Client B project');
  if (select count(*) from public.messages)<>messages_before+1 then
    raise exception 'Forbidden messages survived';
  end if;
end $$;
\echo PASS: client messages accept own identity and reject sender/project spoofing.

set local request.jwt.claim.sub = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
declare count_a int; count_b int;
begin
  select count(*) into count_a from public.approvals where project_id='33333333-3333-4333-8333-333333333333';
  select count(*) into count_b from public.approvals where project_id='44444444-4444-4444-8444-444444444444';
  if count_a<>0 or count_b<>1 then raise exception 'Client B cross-project approval read leaked';end if;
  perform pg_temp.expect_denied(
    $sql$update public.approvals set status='approved',decided_by='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    where id='55555555-5555-4555-8555-555555555551'$sql$,
    'Client B attempts to decide Client A approval');
  if (select count(*) from public.messages)<>0 then
    raise exception 'Client B can read Client A private messages';
  end if;
end $$;
\echo PASS: Client B cannot see or modify Client A approval/messages.

set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
do $$
begin
  update public.approvals set title='Admin authorized update'
  where id='55555555-5555-4555-8555-555555555554';
  if not exists (select 1 from public.approvals
  where id='55555555-5555-4555-8555-555555555554' and title='Admin authorized update')
  then raise exception 'NHS admin lost legitimate write access'; end if;
  insert into public.messages(id,project_id,sender_id,body)
  values ('66666666-6666-4666-8666-666666666664','44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Administrator synthetic message');
end $$;
\echo PASS: NHS admin approval edits and messages allowed.

set local role anon;
set local request.jwt.claim.sub = '';
select pg_temp.expect_denied('select * from public.approvals limit 1','anonymous approval read');
select pg_temp.expect_denied('select * from public.messages limit 1','anonymous message read');
select pg_temp.expect_denied(
  $sql$insert into public.messages(id,project_id,sender_id,body)
  values('66666666-6666-4666-8666-666666666665','33333333-3333-4333-8333-333333333333',
  null,'Unverified')$sql$,'anonymous message write');
\echo PASS: anonymous access denied.

set local role service_role;
do $$
begin
  update public.approvals set title='Service authorized update'
  where id='55555555-5555-4555-8555-555555555554';
  if not exists (select 1 from public.approvals where id='55555555-5555-4555-8555-555555555554'
     and title='Service authorized update') then
    raise exception 'Service-role maintenance unexpectedly blocked';
  end if;
end $$;
\echo PASS: explicit trusted service-role maintenance preserved.

rollback;
-- The synthetic fixture is unchanged after all cases.
do $$
begin
  if (select count(*) from public.approvals) <> 4
    or (select count(*) from public.messages) <> 0 then
    raise exception 'Synthetic fixture changed despite transaction rollback';
  end if;
end $$;
\echo PASS: isolated transaction rolled back; synthetic fixtures untouched.
