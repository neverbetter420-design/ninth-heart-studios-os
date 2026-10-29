# Muse AI: Studio Concierge · Phase 1 review

This feature branch adds a **disabled-by-default**, authenticated, read-only
conversational assistant in the existing admin shell. It is a new intelligence
interface, *not* a replacement for the deterministic Muse draft manager.

## What is real in this implementation

- A responsive Nocturne glass drawer launched through the existing **Muse AI**
  admin header control. Keyboard-friendly close, focus trap, scrollable history,
  contextual prompts, business-record deep links, phone layout.
- Server route `POST /api/admin/muse-ai` that rechecks active admin status for
  **every request** and rejects other users, oversize bodies and cross-origin
  requests. No API key is present in the client JavaScript or repository.
- OpenAI **Responses API** with server-only model credentials; default
  `gpt-6.1-sol`, with allowlisted `gpt-6-luna` and `gpt-6-astra` as
  configurable alternatives. The owner should choose based on real API access,
  latency and cost, not arbitrary UI labels.
- Exactly five narrowly scoped, read-only tools, using the current session's
  Supabase client and RLS: studio overview, current leads, projects, saved
  prospects, and Opportunity Radar. Results cap at 8-18 rows per area, redact
  contact details and link back to real NHS OS screens.
- Up to two tool requests plus a synthesis response, with `store:false`,
  response size limits and a strict server-owned tool allowlist. Records are
  untrusted evidence, never commands. No business record is modified.
- No autonomous processing, scheduled scans, email, client messaging, payments,
  client access or database migration. Existing Muse drafts and send guards
  remain unchanged.

## Flags and secrets for a future, separately approved release

1. Configure `OPENAI_API_KEY` as a **server-side Cloudflare Worker secret**,
   not as a NEXT_PUBLIC variable and never in GitHub source.
2. Optionally set `OPENAI_MUSE_MODEL` to `gpt-6.1-sol`, `gpt-6-luna`,
   or `gpt-6-astra`. Defaults to Sol if omitted.
3. `MUSE_AI_ENABLED=true` is **required** for any paid API request. Leave
   absent/false throughout staging and source review.
4. Recheck that the production Cloudflare deployment uses its existing guarded,
   SHA-bound GitHub Actions workflow. Merely merging the PR does **not**
   authorize production publish or turning on Muse AI.
5. Provision per-owner cost controls and request-rate limiting at the edge
   before enabling production. The current model token/round caps limit one
   request's work but are **not** a distributed rate limiter.

This release is not fully activated by code changes alone. If the flag or API
key is absent, the drawer displays a clear configuration message.

## Important limitations

- **No long-term memory yet.** Conversation messages are held in the browser
  React state and sent back only as a bounded six-message context. Closing the
  page or reloading removes them. Preferences or business notes are **not**
  persisted in this phase.
- AI answers are probabilistic and can still be wrong. Record links and sample
  sizes help the owner verify. Only stored records are consulted; no external
  internet research, live Freelancer/Upwork/Fiverr account reading, or automatic
  background tasks.
- Avoid entering passwords, payment secrets, or sensitive client material in
  chat. Ordinary API data-handling policies still apply; `store:false` does
  not assert zero operational retention by the provider.
- Lists are bounded, not exhaustive. Muse must disclose partial/unavailable
  source data rather than interpreting absence as a zero count.
- The command drawer has no write-capable tools. The existing Muse email-send
  feature remains a separate, explicit per-recipient manual action.

## Acceptance before production

- CI: TypeScript, npm build, browser QA (desktop/mobile), existing RLS and
  access-control tests, `npm run verify:muse` including static AI guard checks.
- API QA: logged-out returns 401; client returns 403; inactive user returns 403;
  valid admin with flag off receives 503; oversized/cross-origin requests fail;
  live admin with enabled server key can request each read tool.
- Reasoning QA with synthetic fixtures: empty/partial rows, conflicting scores,
  stale due dates, malicious instructions inserted into record names, unknown
  tools, and attempts to send outreach must fail closed or answer with limits.
- Visual QA: check drawer focus/close/trap, phone viewport, source links,
  slow responses and errors; existing Muse drafts and admin navigation still
  work.
- Production release is **not** authorized by this design task. No migrations
  or storage changes were applied anywhere.
