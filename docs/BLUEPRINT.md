# NHS OS Rebuild Blueprint

## Product rule

The new NHS OS is not a pixel-for-pixel Softr clone. It preserves the useful workflows, removes platform constraints, and turns the operating system into software owned by Ninth Heart Studios.

## Phase 1 — Foundation (complete)

- Custom Next.js/TypeScript application
- NHS design system
- Responsive application shell
- Command Center
- Core module route structure
- Mock data only
- No live integrations

## Phase 2 — Data + Security (implemented, pending live Supabase credentials)

- Supabase schema and migrations created
- Users, clients, memberships, leads, projects, tasks, activities, opportunities, templates, files, approvals defined
- Cookie-backed authentication wired
- NHS Admin and NHS Client route permissions wired
- Row-level security policies created
- Private project-file storage policies created
- Test-user seeding and cross-client verification scripts created
- Live verification remains blocked until a Supabase project and credentials are connected

## Phase 3 — Lead Intelligence / Flowkeep Logic (implemented, pending live Supabase migration)

- One-field quick capture
- Outbound default + one-tap inbound toggle
- Momentum states: Waiting on Me, Waiting on Them, New Inbound, Prepare for Consultation, Scheduled Consultation
- Quick-log outcomes: Sent Email, Called, DM, Received Reply, Spoke in Person, Not Interested
- SLA: end of next business day for inbound
- Pacific business window: Mon–Fri, cutoff 8 PM
- Priority engine: human reply first, consultation prep second, new inbound response third
- Real lead inbox + lead detail route
- Quick-log outcome server actions
- Dual clocks: inbound SLA vs real elapsed momentum
- Command Center Next 3 Actions now reads live lead records
- Pure Flowkeep verification script for SLA/ranking rules

## Phase 4 — Project Delivery

- Project pipeline
- Workspace
- Milestones and tasks
- Client-visible status
- File uploads
- Approval workflow
- Final payment and launch gates
- Post-launch follow-up sequence

## Phase 5 — Client Portal

- Client-scoped dashboard
- Project status
- Files and uploads
- Approvals
- Documents
- Communication history
- Strict access boundaries

## Phase 6 — Opportunity Radar

- Admin-only opportunity table
- Approved-source import
- Duplicate detection
- Fit scoring
- Bid tracker
- Proposal drafting workspace
- Alerts only after explicit approval

## Phase 7 — Muse

Muse becomes the intelligence layer across the OS. Initial responsibilities:

- Explain why a lead/action is prioritized
- Summarize project risk
- Draft follow-ups and proposals
- Surface stale leads
- Recommend the next studio action
- Never send externally without permission

## Phase 8 — Automations + Integrations

- Email
- Calendar
- File storage
- Invoicing/payments
- Approved lead sources
- Carefully scoped notifications
- Automation audit trail and kill switches

## Migration rule

Softr and Airtable remain the operational system until the custom app passes authentication, role-permission, data-integrity, and workflow tests. Production migration happens last.
