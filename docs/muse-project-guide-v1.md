# Muse Project Guide v1

Status: source-only draft on the Muse review branch. Disabled by default. No
hosted migration, production activation, scan, message, outreach or deployment
is part of this change.

## What this phase adds

- **Project Heartbeat:** an explainable advisory based only on recorded blocked
  tasks, overdue tasks and pending approvals. It is not a prediction or a
  judgment of creative quality.
- **One Move:** a deterministic next-action selector that prefers executable,
  high-priority subtasks, then the earliest due work.
- **Real subtasks:** one parent level plus one subtask level, with database
  enforcement against same-task, cross-project and deeper nesting.
- **Useful task detail:** optional guidance, definition of done, focus estimate,
  ordering and the manual/Muse source.
- **Plan preview:** an admin can ask Muse for a structured plan generated from a
  complete bounded read of the current project, tasks, milestones and pending
  approvals.
- **Exact approval:** the generated plan is stored as a private owner-bound
  draft. The interface shows every task and subtask before the admin can approve
  creation.
- **Atomic application:** `apply_muse_project_plan()` rechecks the authenticated
  admin, plan owner, draft state, expiry and every task bound. Either the entire
  approved plan is created or none of it is.
- **Audit receipt:** successful application records the plan, creation count and
  private project activity event.

## Boundaries

- `MUSE_PROJECT_GUIDE_ENABLED` defaults to `false` and is independent from the
  existing conversational Muse flag.
- General Muse chat remains read-only. It can explain Heartbeat and One Move but
  cannot apply plans.
- Plan generation cannot send messages, contact clients, run scans, bid,
  publish, delete, schedule or make financial commitments.
- Client-visible tasks default to false. The plan preview must explicitly show
  any task proposed as client-visible.
- Plans expire after 24 hours and cannot be applied twice.
- The first release supports at most 12 parent tasks, 8 subtasks per parent and
  48 created tasks total.
- Model output uses Responses API Structured Outputs with a strict JSON schema,
  followed by independent server validation and database validation. The plan
  request uses `store: false`.

## Database and access model

Draft migration: `20261029184832_muse_project_guide_v1.sql`.

The verified hosted baseline remains 25 applied migrations. This new file is a
reviewed source candidate only. It creates `muse_project_plans`, extends `tasks`,
adds a one-level hierarchy trigger and adds the security-invoker application
function. The plan table has RLS enabled and is restricted to the active admin
who created the draft. Clients and anonymous users have no plan access.

Supabase's October 30, 2026 Data API exposure change is handled explicitly:
the migration revokes public/anonymous access and grants the authenticated role
only the operations subsequently constrained by RLS.

## Verification

- TypeScript compile
- Existing 25 Muse runtime checks
- 7 Project Guide domain/security checks
- 91 isolated admin-action outcomes, including same-project subtask creation
  and protected parent deletion
- Desktop and mobile browser approval flow with mocked local-only provider data
- Existing three-viewport Muse drawer QA
- Disposable local Supabase CI now verifies real RLS, exact-plan application,
  client denial, nesting protection, parent deletion protection and audit rows
- Production Next/OpenNext build and Cloudflare dry run remain required before
  any release decision

## Remaining release gates

1. Disposable Supabase workflow must apply all migrations and pass real
   Auth/PostgREST/RPC checks.
2. Real-provider acceptance must confirm the configured model supports the
   strict plan schema and refusal/incomplete handling.
3. Visual review must approve desktop and phone plan states.
4. The exact migration and resulting source commit require explicit production
   migration and deployment approval.
5. Configure the server-only OpenAI key, verified model, rate-limit namespace
   and budget policy before enabling either Muse flag.
