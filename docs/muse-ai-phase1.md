# Muse AI: evidence-backed studio concierge

Muse extends the existing admin drawer and deterministic draft manager. This is
an implementation on PR #51's development branch. It is disabled by default;
source review does not activate the model or publish a production Worker.

## Implemented

- Active-admin authorization on every API request, same-origin JSON only,
  bounded UTF-8 request/provider streams and no-store responses on every path.
- Server-only OpenAI Responses API; allowlisted existing model choices remain
  `gpt-6.1-sol` (default), `gpt-6-luna`, `gpt-6-astra`. The first model response
  must request current evidence. Answers without a successful evidence-tool
  invocation, incomplete responses and malformed/unknown tool calls fail closed.
- At most four sequential read-tool calls plus synthesis (five model requests,
  each capped at 2,000 output tokens). Every response item, including encrypted
  reasoning, is replayed in order with `store:false`. Tool results are cached
  only within the current request. There is a shared 45-second provider/data
  deadline and a 20-second timeout per provider call.
- Five tools with no model-supplied arguments. All use the current user session
  and existing RLS, never a privileged Supabase client:
  - `lead_priorities`: canonical Flowkeep attention/SLA rules, not recency or an
    AI-generated score. Up to 18 ranked lead summaries.
  - `project_watch`: projects plus unfinished tasks/milestones and pending
    approvals. Current project detail pages narrow this read to that project.
    Up to 18 projects, 5 task details, 3 milestones and 3 approvals per project.
  - `prospect_comparison`: the scanner's shared category shortlist algorithm,
    70% public contact reliability and 30% recorded opportunity. Top 3 within
    each category, excluding contacted/drafted/protected/uncontactable records.
    Recorded Instagram/Facebook `status=matched` is used; no new scan runs.
  - `opportunity_radar`: top 15 saved, non-closed opportunities by recorded
    score, preserving source labels. No marketplace account access is implied.
  - `studio_overview`: evidence from leads, project delivery and saved
    opportunities, with up to six displayed summaries from each area.
- Each underlying table read requests an exact count and at most 1,000 rows.
  Errors, lower API row caps, missing counts and larger lists withhold that
  area's conclusions. Project review fails closed if a related read fails.
  Coverage is returned separately from the smaller displayed/model summaries.
  Queries are not a transactionally consistent cross-table snapshot.
- Contact addresses, phones, emails, full signals, internal notes, client
  comments and protected outreach drafts are not sent to the model. Record and
  task titles remain untrusted content; they never define tool instructions.
- Request controls use `MUSE_AI_RATE_LIMITER`, keyed by authenticated owner ID.
  Missing/unavailable binding returns 503 before any provider call. A denied
  request returns 429 and `Retry-After: 60`.
- Sparse glass drawer with contextual prompts, source links, expandable evidence
  coverage, Stop, New chat, keyboard focus containment and body scroll locking.
  No external/AI-generated links or HTML are rendered from model text.

## Release configuration

`MUSE_AI_ENABLED` stays absent/false until a separately approved release.
`OPENAI_API_KEY` must be a server-side Worker secret. Never put it in chat,
source, a pull-request check or any `NEXT_PUBLIC_` variable. The UI reports an
unconfigured state without asking an ordinary user for credentials.

The proposed Wrangler binding uses namespace `929010`, six requests per
60 seconds per owner per Cloudflare location. Verify namespace uniqueness in
the account before publishing. Cloudflare limits are approximate and local to
each location; this is **not a strict global quota or dollar spend cap**.
Separate provider budget controls/AI Gateway cost policy remain release work.
No cloud configuration has been applied merely by editing this file.

## Verification

- `npm run verify:muse` includes the existing deterministic Muse tests, static
  read-only/security contracts and 25 runtime checks of the actual route,
  data reader, model loop and limiter with injected synthetic dependencies.
- `node scripts/verify-muse-ai-browser.mjs` hydrates the real drawer on the
  source-rendered synthetic Admin page. It exercises answer/coverage links,
  reset/cancel, keyboard focus/return and geometry at 1440, 390 and 320 pixels,
  plus project-context prompts. Provider answers are fixtures, not AI evals.
- Standard TypeScript, scanner/domain checks, guarded migration inventory,
  production build, Cloudflare dry-run/runtime and existing offline gallery QA
  still apply. Browser screenshots are synthetic, not live client records.

## Remaining release and feature work

No hosted data/identity or paid-model evaluation is performed by these tests.
Before enabling, run authenticated admin/client/inactive session tests against
an isolated environment, verify current model access and evidence quality with
real provider responses, review visual output, set budget controls and obtain
approval for the exact guarded deployment. Existing migration inventory guards
are unchanged; this implementation adds no schema migration.

Conversation state lasts only in the mounted browser session (bounded recent
context); reload clears it. There is no durable history, saved memory, write
execution, scheduling, autonomous outreach or background scans. Stop cancels
the browser request; provider cancellation/billing may not be instantaneous.
Saved Fiverr/Upwork/Freelancer source labels are supported in analysis, but live
account integrations and discovery must be implemented through supported APIs
and verified independently. Do not label this milestone a live marketplace
integration or a fully activated assistant.

`store:false` disables provider response storage for later retrieval; it does
not assert zero operational retention. Only factual saved evidence should be
used for claims; probabilistic answers still require owner judgment.

References:
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/conversation-state
- https://supabase.com/docs/guides/api/sql-to-api
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
