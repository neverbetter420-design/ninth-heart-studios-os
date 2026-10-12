-- Phase 4 — Client approval decisions.
-- Lets clients approve/decline their own pending approvals from the portal.
-- Strictly scoped: only pending rows on their own projects, only the
-- approved/declined transition. All writes go through the portal server action.

drop policy if exists "Clients decide own pending approvals" on public.approvals;
create policy "Clients decide own pending approvals" on public.approvals
  for update to authenticated
  using (
    status = 'pending'
    and (select private.can_access_project(project_id))
  )
  with check (
    status in ('approved', 'declined')
    and (select private.can_access_project(project_id))
  );
