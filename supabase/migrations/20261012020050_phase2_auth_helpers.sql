create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.active = true
      and p.role = 'admin'::public.app_role
  );
$$;

create or replace function private.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_admin()
    or exists (
      select 1
      from public.client_memberships cm
      join public.profiles p on p.id = cm.profile_id
      where cm.client_id = target_client_id
        and cm.profile_id = (select auth.uid())
        and p.active = true
    );
$$;

create or replace function private.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_admin()
    or exists (
      select 1
      from public.projects pr
      join public.client_memberships cm on cm.client_id = pr.client_id
      join public.profiles p on p.id = cm.profile_id
      where pr.id = target_project_id
        and cm.profile_id = (select auth.uid())
        and p.active = true
    );
$$;

create or replace function private.can_access_project_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
  target_client uuid;
  target_project uuid;
begin
  folders := storage.foldername(object_name);
  if array_length(folders, 1) < 3 then
    return false;
  end if;

  begin
    target_client := folders[1]::uuid;
    target_project := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return private.is_admin() or exists (
    select 1
    from public.projects pr
    join public.client_memberships cm on cm.client_id = pr.client_id
    join public.profiles p on p.id = cm.profile_id
    where pr.id = target_project
      and pr.client_id = target_client
      and cm.profile_id = (select auth.uid())
      and p.active = true
  );
end;
$$;

revoke all on function private.is_admin() from public, anon;
revoke all on function private.can_access_client(uuid) from public, anon;
revoke all on function private.can_access_project(uuid) from public, anon;
revoke all on function private.can_access_project_path(text) from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.can_access_client(uuid) to authenticated;
grant execute on function private.can_access_project(uuid) to authenticated;
grant execute on function private.can_access_project_path(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role public.app_role;
begin
  requested_role := case
    when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'::public.app_role
    else 'client'::public.app_role
  end;

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    requested_role,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','clients','leads','projects','tasks','opportunities','templates','approvals'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  end loop;
end $$;

-- Explicit API grants. RLS below remains the row-level authority.
revoke all on table public.profiles, public.clients, public.client_memberships, public.leads,
  public.projects, public.tasks, public.activities, public.opportunities, public.templates,
  public.files, public.approvals from public, anon;

grant select, insert, update, delete on table public.profiles, public.clients, public.client_memberships,
  public.leads, public.projects, public.tasks, public.activities, public.opportunities,
  public.templates, public.files, public.approvals to authenticated;

