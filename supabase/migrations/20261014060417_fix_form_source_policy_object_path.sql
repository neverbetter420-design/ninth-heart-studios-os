-- Restored from the active NHS Supabase project's applied migration record
-- 20261014060417_fix_form_source_policy_object_path (read-only inspection).
-- This file restores source/history parity. It does NOT reapply changes
-- to production; the policy is already installed there.
--
-- Fix unintended name binding in the form-sources storage policy.
-- The previous policy compared form_templates.source_file_path to
-- form_templates.name, rather than the requested storage object's name.
-- Explicitly qualify the storage object path to restrict access to
-- PDFs associated with forms assigned to the authenticated client's projects.
drop policy if exists "Clients read sent form sources" on storage.objects;

create policy "Clients read sent form sources" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-sources'
    and exists (
      select 1
      from public.form_templates as ft
      join public.form_submissions as fs on fs.template_id = ft.id
      where ft.source_file_path = storage.objects.name
        and (select private.can_access_project(fs.project_id))
    )
  );
