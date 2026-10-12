-- Ninth Heart Studios OS — Phase 2
-- Database, authentication profile model, roles, RLS, and private file policies.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum ('admin', 'client');
  end if;
  if not exists (select 1 from pg_type where typname = 'file_visibility' and typnamespace = 'public'::regnamespace) then
    create type public.file_visibility as enum ('internal', 'client');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  primary_email text,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_memberships (
  client_id uuid not null references public.clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'client',
  created_at timestamptz not null default now(),
  primary key (client_id, profile_id)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  business_name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  acquisition_type text not null default 'outbound',
  momentum_state text not null default 'Waiting on Them',
  score integer check (score between 0 and 100),
  status text not null default 'prospect',
  owner_id uuid references public.profiles(id) on delete set null,
  next_action_due timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  status text not null default 'discovery',
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  internal_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'not_started',
  priority text not null default 'normal',
  due_at timestamptz,
  assignee_id uuid references public.profiles(id) on delete set null,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  summary text not null,
  client_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (project_id is not null or lead_id is not null)
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  title text not null,
  url text,
  score integer check (score between 0 and 100),
  fit text,
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  content jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  object_path text not null unique,
  filename text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  visibility public.file_visibility not null default 'client',
  created_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  status text not null default 'pending',
  requested_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  client_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_client_memberships_profile on public.client_memberships(profile_id);
create index if not exists idx_projects_client on public.projects(client_id);
create index if not exists idx_tasks_project_visible on public.tasks(project_id, client_visible);
create index if not exists idx_activities_project_visible on public.activities(project_id, client_visible);
create index if not exists idx_files_project_visibility on public.files(project_id, visibility);
create index if not exists idx_approvals_project on public.approvals(project_id);
create index if not exists idx_leads_owner on public.leads(owner_id);

