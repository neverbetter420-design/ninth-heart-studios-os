# Phase 3 — Lead Intelligence / Flowkeep

Phase 3 turns Lead Intelligence from a route shell into a deterministic lead-to-consultation engine.

## Locked product rules

### Acquisition

- Outbound is the default capture type.
- Inbound is a one-selection override.
- Minimum capture is one field: business name.
- Outbound with an email/phone gets `Send first outreach`.
- Outbound without a direct contact method gets `Find contact method`.
- Inbound gets `Respond to new lead` and an SLA timestamp.

### Momentum states

- `Waiting on Me`
- `Waiting on Them`
- `New Inbound`
- `Prepare for Consultation`
- `Scheduled Consultation`

### Quick-log outcomes

- Sent Email
- Called
- DM (IG/FB)
- Received Reply
- Spoke in Person
- Not Interested

### Priority order

The first three ranking buckets are intentionally locked:

1. Human reply
2. Consultation preparation
3. New inbound response

Outbound first outreach, research, and ordinary follow-up cannot outrank those buckets merely because they are old.

### Inbound SLA

- Time zone: `America/Los_Angeles`
- Business days: Monday–Friday
- Daily cutoff: 8:00 PM Pacific
- Normal inbound: due at 8:00 PM on the next business day
- After-cutoff/weekend inbound: enters the queue the next business day, then becomes due at 8:00 PM on the following business day
- First outbound response marks the inbound SLA as met
- Real elapsed momentum continues independently after the SLA is met

## Database migration

Apply:

`supabase/migrations/20261012030000_phase3_flowkeep.sql`

This adds structured timing, outcome, next-action, and consultation fields to `leads`.

## Validation

Pure logic test:

```bash
npm run verify:flowkeep
```

The test covers business-day SLA calculations, one-field capture decisions, quick-log transitions, and the locked ranking order.

After Supabase is connected, seed the five validation scenarios:

```bash
npm run seed:flowkeep
```

The expected top three are:

1. Flowkeep — Human Reply
2. Flowkeep — Consultation
3. Flowkeep — New Inbound

## UI included

- One-field quick capture
- Lead metrics
- Ranked momentum inbox
- Lead detail route
- Dual clocks: SLA + real elapsed momentum
- Quick-log outcome controls
- Consultation scheduling
- Lead activity timeline
- Command Center Next 3 Actions using live lead records

## Safety boundary

Phase 3 does not send email, DMs, calls, bids, or alerts. Logging an outcome changes internal state only. External actions remain manual until a later approved integration phase.
