-- Ninth Heart Studios OS — Phase 3
-- Flowkeep lead timing, momentum, and deterministic next-action fields.

alter table public.leads
  add column if not exists original_inquiry_at timestamptz,
  add column if not exists last_outreach_at timestamptz,
  add column if not exists last_reply_at timestamptz,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists consultation_at timestamptz,
  add column if not exists next_action text,
  add column if not exists next_action_kind text,
  add column if not exists last_outcome text;

update public.leads
set
  next_action = coalesce(next_action,
    case
      when acquisition_type = 'inbound' then 'Respond to new lead'
      when coalesce(email, phone) is not null then 'Send first outreach'
      else 'Find contact method'
    end
  ),
  next_action_kind = coalesce(next_action_kind,
    case
      when acquisition_type = 'inbound' then 'new_inbound'
      when coalesce(email, phone) is not null then 'first_outreach'
      else 'research'
    end
  ),
  original_inquiry_at = case
    when acquisition_type = 'inbound' then coalesce(original_inquiry_at, created_at)
    else original_inquiry_at
  end;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_acquisition_type_check') then
    alter table public.leads
      add constraint leads_acquisition_type_check
      check (acquisition_type in ('outbound', 'inbound'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_momentum_state_check') then
    alter table public.leads
      add constraint leads_momentum_state_check
      check (momentum_state in (
        'Waiting on Me',
        'Waiting on Them',
        'New Inbound',
        'Prepare for Consultation',
        'Scheduled Consultation'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_next_action_kind_check') then
    alter table public.leads
      add constraint leads_next_action_kind_check
      check (next_action_kind is null or next_action_kind in (
        'reply',
        'consultation',
        'new_inbound',
        'follow_up',
        'first_outreach',
        'research',
        'closed'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_last_outcome_check') then
    alter table public.leads
      add constraint leads_last_outcome_check
      check (last_outcome is null or last_outcome in (
        'Sent Email',
        'Called',
        'DM (IG/FB)',
        'Received Reply',
        'Spoke in Person',
        'Not Interested'
      ));
  end if;
end $$;

create index if not exists idx_leads_momentum_priority
  on public.leads(status, momentum_state, next_action_due, last_activity_at desc);

create index if not exists idx_leads_inbound_sla
  on public.leads(acquisition_type, original_inquiry_at, next_action_due)
  where acquisition_type = 'inbound';
