-- Create the `project-files` bucket.
--
-- The bucket previously existed only because it was created manually
-- in the dashboard; the Phase 2 migration wrote storage policies for
-- it but never created it. A fresh DB built from migrations alone
-- would break all file uploads. This makes the bucket part of the
-- schema, like `form-sources`.

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;
