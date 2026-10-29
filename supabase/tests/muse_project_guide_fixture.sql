-- Disposable PostgreSQL 17 fixture. No Supabase network connection or customer records.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists private;
do $$
begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $$;
create type public.app_role as enum ('admin','client');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth, private to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.profiles (
 id uuid primary key,
 role public.app_role not null,
 active boolean not null default true
);
create table public.projects (
 id uuid primary key,
 client_id uuid not null,
 name text not null,
 status text not null default 'discovery',
 progress integer not null default 0,
 due_date date,
 internal_notes text,
 updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 title text not null,
 status text not null default 'not_started',
 priority text not null default 'normal',
 client_visible boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.milestones (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 title text not null,
 status text not null default 'not_started',
 position integer not null default 0,
 updated_at timestamptz not null default now()
);
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active and role='admin'::public.app_role);
$$;
create function private.can_access_project(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.projects where id=p_id);
$$;
grant execute on function private.is_admin(), private.can_access_project(uuid) to authenticated;
grant select on public.profiles, public.projects, public.tasks, public.milestones to authenticated;
insert into public.profiles(id,role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','client');
insert into public.projects(id,client_id,name)
  values ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Test project');
alter table public.milestones enable row level security;
create policy "Clients read own project milestones" on public.milestones
  for select to authenticated using ((select private.can_access_project(project_id)));
