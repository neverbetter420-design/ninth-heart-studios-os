-- Recorded in the active Supabase migration history as 20261015001941.
-- Keep the private project-files storage limit aligned with lib/files.ts (25 MiB).
-- Safe to re-run; does not remove or modify any stored files.
update storage.buckets
set file_size_limit = 26214400
where id = 'project-files' and public = false;
