-- Phase 5 — Client Portal: messages + documents.
-- Messages: per-project two-way communication thread.
-- Documents: shared formal records (contracts, proposals, invoices, handoff).

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  kind text not null default 'other',
  file_id uuid references public.files(id) on delete set null,
  external_url text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind in ('contract', 'proposal', 'invoice', 'handoff', 'other'))
);

create index if not exists idx_messages_project on public.messages(project_id);
create index if not exists idx_documents_project on public.documents(project_id);

alter table public.messages enable row level security;
alter table public.documents enable row level security;

-- Messages: admins manage everything; clients read and send on own projects.
drop policy if exists "Admins manage messages" on public.messages;
create policy "Admins manage messages" on public.messages
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own project messages" on public.messages;
create policy "Clients read own project messages" on public.messages
  for select to authenticated
  using ((select private.can_access_project(project_id)));

drop policy if exists "Clients send project messages" on public.messages;
create policy "Clients send project messages" on public.messages
  for insert to authenticated
  with check ((select private.can_access_project(project_id)));

-- Documents: admins manage everything; clients read on own projects.
drop policy if exists "Admins manage documents" on public.documents;
create policy "Admins manage documents" on public.documents
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own project documents" on public.documents;
create policy "Clients read own project documents" on public.documents
  for select to authenticated
  using ((select private.can_access_project(project_id)));
