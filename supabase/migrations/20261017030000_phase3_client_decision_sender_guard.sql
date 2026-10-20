-- Phase 3 security hardening: DRAFT ONLY. Do not run in active Supabase
-- without a separate approval, isolated-DB validation and rollback review.
-- Existing user/client data and approval decisions are not modified here.
--
-- Defenses:
-- 1. A client must not edit metadata of a pending approval while deciding it,
--    including future-added columns. Admin/server roles remain capable of
--    legitimate project administration.
-- 2. A client-created message cannot claim somebody else's sender_id.
--
-- The already-installed trigger set_approvals_updated_at runs before
-- zz_guard_client_approval_decision (Postgres sorts same-kind triggers by name).
-- This is intentional: updated_at is managed by the existing trigger.

create or replace function private.guard_client_approval_decision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  -- These are server-side privileged roles, not user-editable JWT claims.
  -- App admins are checked against private.profiles by private.is_admin().
  if current_user in ('postgres', 'service_role') or private.is_admin() then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'Authentication required to decide an approval'
      using errcode = '42501';
  end if;

  if old.status <> 'pending' or new.status not in ('approved', 'declined') then
    raise exception 'Only a pending approval can be decided'
      using errcode = '42501';
  end if;

  -- Deny edits to every field except the approved decision fields, including
  -- any new fields added later. The old/new row access is already bound by
  -- the existing RLS policy to the client's own pending approval.
  if (to_jsonb(new) - array[
    'status', 'client_comment', 'decided_by', 'decided_at', 'updated_at'
  ]) is distinct from (to_jsonb(old) - array[
    'status', 'client_comment', 'decided_by', 'decided_at', 'updated_at'
  ]) then
    raise exception 'Approval metadata is not editable by clients'
      using errcode = '42501';
  end if;

  if new.decided_by is distinct from (select auth.uid()) then
    raise exception 'Approval decision must belong to the current user'
      using errcode = '42501';
  end if;

  if length(coalesce(new.client_comment, '')) > 280 then
    raise exception 'Approval comment is too long'
      using errcode = '22001';
  end if;

  -- Client-supplied decision timestamps cannot be trusted. Preserve
  -- set_approvals_updated_at's independent updated_at management.
  new.decided_at := pg_catalog.statement_timestamp();
  return new;
end;
$function$;

revoke all on function private.guard_client_approval_decision()
  from public, anon;
grant execute on function private.guard_client_approval_decision()
  to authenticated;

drop trigger if exists zz_guard_client_approval_decision
  on public.approvals;
create trigger zz_guard_client_approval_decision
  before update on public.approvals
  for each row
  execute function private.guard_client_approval_decision();

-- Keep both OLD and NEW row checks, plus signed-in decision ownership. Even
-- if a later code path bypasses the application form, the DB enforces this.
drop policy if exists "Clients decide own pending approvals" on public.approvals;
create policy "Clients decide own pending approvals" on public.approvals
  for update to authenticated
  using (
    status = 'pending'
    and (select private.can_access_project(project_id))
  )
  with check (
    status in ('approved', 'declined')
    and decided_by = (select auth.uid())
    and decided_at is not null
    and (select private.can_access_project(project_id))
  );

-- Admins retain the independent "Admins manage messages" policy. The client
-- INSERT policy now verifies the claimed sender is the signed-in principal.
drop policy if exists "Clients send project messages" on public.messages;
create policy "Clients send project messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.can_access_project(project_id))
  );

-- A standalone migration intentionally does not create/dispose test users,
-- write approvals/messages, activate automations, or change live account roles.
