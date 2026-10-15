-- Applied to NHS OS Supabase as migration 20261015005039.
-- Index high-use operational foreign keys without changing records or RLS.
create index if not exists idx_leads_client_id_fk on public.leads(client_id);
create index if not exists idx_prospects_lead_id_fk on public.prospects(lead_id);
create index if not exists idx_files_uploaded_by_fk on public.files(uploaded_by);
create index if not exists idx_messages_sender_id_fk on public.messages(sender_id);
create index if not exists idx_activities_lead_id_fk on public.activities(lead_id);
create index if not exists idx_tasks_assignee_id_fk on public.tasks(assignee_id);
create index if not exists idx_sent_emails_lead_id_fk on public.sent_emails(lead_id);
