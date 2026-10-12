alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_memberships enable row level security;
alter table public.leads enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.activities enable row level security;
alter table public.opportunities enable row level security;
alter table public.templates enable row level security;
alter table public.files enable row level security;
alter table public.approvals enable row level security;

-- Profiles
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()));

-- Clients and memberships
drop policy if exists "Admins manage clients" on public.clients;
create policy "Admins manage clients" on public.clients
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own client account" on public.clients;
create policy "Clients read own client account" on public.clients
  for select to authenticated
  using ((select private.can_access_client(id)));

drop policy if exists "Admins manage memberships" on public.client_memberships;
create policy "Admins manage memberships" on public.client_memberships
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Users read own memberships" on public.client_memberships;
create policy "Users read own memberships" on public.client_memberships
  for select to authenticated
  using ((select auth.uid()) is not null and profile_id = (select auth.uid()));

-- Admin-only operational tables
drop policy if exists "Admins manage leads" on public.leads;
create policy "Admins manage leads" on public.leads
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins manage opportunities" on public.opportunities;
create policy "Admins manage opportunities" on public.opportunities
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins manage templates" on public.templates;
create policy "Admins manage templates" on public.templates
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Projects
drop policy if exists "Admins manage projects" on public.projects;
create policy "Admins manage projects" on public.projects
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own projects" on public.projects;
create policy "Clients read own projects" on public.projects
  for select to authenticated
  using ((select private.can_access_client(client_id)));

-- Tasks
drop policy if exists "Admins manage tasks" on public.tasks;
create policy "Admins manage tasks" on public.tasks
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read visible project tasks" on public.tasks;
create policy "Clients read visible project tasks" on public.tasks
  for select to authenticated
  using (client_visible = true and (select private.can_access_project(project_id)));

-- Activities
drop policy if exists "Admins manage activities" on public.activities;
create policy "Admins manage activities" on public.activities
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read visible project activity" on public.activities;
create policy "Clients read visible project activity" on public.activities
  for select to authenticated
  using (
    client_visible = true
    and project_id is not null
    and (select private.can_access_project(project_id))
  );

-- File metadata
drop policy if exists "Admins manage file metadata" on public.files;
create policy "Admins manage file metadata" on public.files
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read visible project files" on public.files;
create policy "Clients read visible project files" on public.files
  for select to authenticated
  using (visibility = 'client'::public.file_visibility and (select private.can_access_project(project_id)));

drop policy if exists "Clients add project file metadata" on public.files;
create policy "Clients add project file metadata" on public.files
  for insert to authenticated
  with check (
    visibility = 'client'::public.file_visibility
    and uploaded_by = (select auth.uid())
    and (storage.foldername(object_path))[3] = 'client'
    and (select private.can_access_project_path(object_path))
    and (select private.can_access_project(project_id))
  );

drop policy if exists "Clients remove own project file metadata" on public.files;
create policy "Clients remove own project file metadata" on public.files
  for delete to authenticated
  using (
    visibility = 'client'::public.file_visibility
    and uploaded_by = (select auth.uid())
    and (storage.foldername(object_path))[3] = 'client'
    and (select private.can_access_project_path(object_path))
    and (select private.can_access_project(project_id))
  );

-- Approvals are readable by clients in Phase 2; mutation is added with the approval workflow.
drop policy if exists "Admins manage approvals" on public.approvals;
create policy "Admins manage approvals" on public.approvals
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Clients read own approvals" on public.approvals;
create policy "Clients read own approvals" on public.approvals
  for select to authenticated
  using ((select private.can_access_project(project_id)));

-- Storage policies for a PRIVATE bucket named `project-files`.
-- Object path format: <client_uuid>/<project_uuid>/<client|internal>/<filename>
drop policy if exists "NHS admins manage project files" on storage.objects;
create policy "NHS admins manage project files" on storage.objects
  for all to authenticated
  using (bucket_id = 'project-files' and (select private.is_admin()))
  with check (bucket_id = 'project-files' and (select private.is_admin()));

drop policy if exists "NHS clients read client project files" on storage.objects;
create policy "NHS clients read client project files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[3] = 'client'
    and (select private.can_access_project_path(name))
  );

drop policy if exists "NHS clients upload client project files" on storage.objects;
create policy "NHS clients upload client project files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[3] = 'client'
    and (select private.can_access_project_path(name))
  );

drop policy if exists "NHS clients delete own client project files" on storage.objects;
create policy "NHS clients delete own client project files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-files'
    and owner_id = (select auth.uid()::text)
    and (storage.foldername(name))[3] = 'client'
    and (select private.can_access_project_path(name))
  );
