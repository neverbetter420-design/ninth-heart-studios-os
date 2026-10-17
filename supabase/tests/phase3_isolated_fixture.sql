-- Synthetic PostgreSQL 17 security fixture for the exact unapplied NHS OS
-- Phase 3 migration. This is intentionally NOT a connection to Supabase.
-- PostgreSQL superuser executes this file in a disposable CI service.
\set ON_ERROR_STOP on

create role authenticated nologin;
create role anon nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema private;
grant usage on schema auth,private to authenticated;
grant usage on schema auth to anon;
create or replace function auth.uid() returns uuid
language sql stable set search_path='' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant execute on function auth.uid() to authenticated,anon;

create table public.profiles (
  id uuid primary key,
  role text not null check (role in ('admin','client')),
  active boolean not null default true
);
create table public.clients (
  id uuid primary key,
  name text not null
);
create table public.client_memberships (
  client_id uuid not null references public.clients(id),
  profile_id uuid not null references public.profiles(id),
  primary key (client_id,profile_id)
);
create table public.projects (
  id uuid primary key,
  client_id uuid not null references public.clients(id),
  name text not null
);
create table public.approvals (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  title text not null,
  status text not null default 'pending',
  requested_by uuid references public.profiles(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  client_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A simulated future schema column demonstrates fail-closed behavior.
  approval_source text not null default 'created-by-admin'
);
create table public.messages (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  sender_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role='admin' and p.active
  );
$$;
create or replace function private.can_access_project(target_project uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.is_admin() or exists (
    select 1
    from public.projects pr
    join public.client_memberships cm on cm.client_id=pr.client_id
    join public.profiles p on p.id=cm.profile_id
    where pr.id=target_project and cm.profile_id=(select auth.uid()) and p.active
  );
$$;
revoke all on function private.is_admin() from public,anon;
revoke all on function private.can_access_project(uuid) from public,anon;
grant execute on function private.is_admin(),private.can_access_project(uuid) to authenticated;

-- Reproduce the existing row-level policy structure and table grants.
alter table public.approvals enable row level security;
alter table public.messages enable row level security;
grant select,insert,update,delete on public.approvals,public.messages to authenticated;
grant select,insert,update,delete on public.approvals,public.messages to service_role;
create policy "Admins manage approvals" on public.approvals
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy "Clients read own approvals" on public.approvals
for select to authenticated using ((select private.can_access_project(project_id)));
create policy "Clients decide own pending approvals" on public.approvals
for update to authenticated
using (status='pending' and (select private.can_access_project(project_id)))
with check (status in ('approved','declined') and (select private.can_access_project(project_id)));
create policy "Admins manage messages" on public.messages
for all to authenticated using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy "Clients read own project messages" on public.messages
for select to authenticated using ((select private.can_access_project(project_id)));
create policy "Clients send project messages" on public.messages
for insert to authenticated with check ((select private.can_access_project(project_id)));
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger set_approvals_updated_at before update on public.approvals
for each row execute function public.set_updated_at();

-- Explicit, synthetic seed rows. Never use real account identities.
insert into public.profiles(id,role) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','client'),
('cccccccc-cccc-4ccc-8ccc-cccccccccccc','client');
insert into public.clients(id,name) values
('11111111-1111-4111-8111-111111111111','Synthetic Client A'),
('22222222-2222-4222-8222-222222222222','Synthetic Client B');
insert into public.client_memberships(client_id,profile_id) values
('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
('22222222-2222-4222-8222-222222222222','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.projects(id,client_id,name) values
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','Synthetic Project A'),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','Synthetic Project B');
insert into public.approvals(id,project_id,title,status,requested_by) values
('55555555-5555-4555-8555-555555555551','33333333-3333-4333-8333-333333333333','Synthetic Pending A','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('55555555-5555-4555-8555-555555555552','33333333-3333-4333-8333-333333333333','Synthetic Decline A','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('55555555-5555-4555-8555-555555555553','33333333-3333-4333-8333-333333333333','Already Decided A','approved','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('55555555-5555-4555-8555-555555555554','44444444-4444-4444-8444-444444444444','Synthetic Pending B','pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

\echo Synthetic PostgreSQL 17 authorization fixture initialized.
