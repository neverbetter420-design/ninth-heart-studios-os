-- PDF import support: keep the source PDF as the branded reference.
--
-- form_templates gains source_file_path / source_file_name — the
-- uploaded PDF stored in the private `form-sources` bucket, path
-- convention `templates/{template_id}/{filename}`.
--
-- Storage RLS: admins manage; clients read the source PDF for forms
-- that were sent to their own projects.

alter table public.form_templates
  add column if not exists source_file_path text,
  add column if not exists source_file_name text;

insert into storage.buckets (id, name, public)
values ('form-sources', 'form-sources', false)
on conflict (id) do nothing;

drop policy if exists "Admins manage form sources" on storage.objects;
create policy "Admins manage form sources" on storage.objects
  for all to authenticated
  using (bucket_id = 'form-sources' and (select private.is_admin()))
  with check (bucket_id = 'form-sources' and (select private.is_admin()));

drop policy if exists "Clients read sent form sources" on storage.objects;
create policy "Clients read sent form sources" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-sources'
    and exists (
      select 1 from public.form_templates t
      join public.form_submissions s on s.template_id = t.id
      where t.source_file_path = name
        and (select private.can_access_project(s.project_id))
    )
  );
