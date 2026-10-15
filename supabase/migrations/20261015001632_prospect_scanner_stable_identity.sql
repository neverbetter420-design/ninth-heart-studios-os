-- Applied to the active project as migration 20261015001632.
-- Non-destructive: existing prospects keep their IDs and source_ref NULL.
alter table public.prospects add column if not exists source_ref text;
create unique index if not exists prospects_source_ref_unique
  on public.prospects (source_ref) where source_ref is not null;
