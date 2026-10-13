-- Phase 8 — Email via Google Workspace: sent-email audit trail.
--
-- Every email the studio sends through the app is logged here. Combined with
-- the per-send approval in the UI, this is the "carefully scoped" part:
-- nothing goes out without a human clicking send, and everything is recorded.

create table if not exists public.sent_emails (
  id uuid primary key default gen_random_uuid(),
  to_address text not null,
  subject text not null,
  body text not null,
  draft_id uuid references public.muse_drafts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  sent_by uuid references public.profiles(id) on delete set null,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists sent_emails_created_idx
  on public.sent_emails(created_at desc);

alter table public.sent_emails enable row level security;

drop policy if exists "Admins read sent emails" on public.sent_emails;
create policy "Admins read sent emails" on public.sent_emails
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
