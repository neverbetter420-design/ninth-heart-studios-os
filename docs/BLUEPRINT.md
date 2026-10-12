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

## Approved visual identity — NOCTURNE ELECTRIC

Dark gothic luxury meets a futuristic command center: elegant, mysterious, electric, premium, and restrained. This identity applies across every phase and both admin and client experiences. Avoid generic SaaS styling.

| Role | Approved value |
| --- | --- |
| Background | #09070E |
| Primary surfaces | #17101F, #21172D |
| Metallic copper | #C78A70 |
| Electric magenta | #FF348F |
| Violet | #AD5CFF |
| Cobalt blue | #487BFF |
| Main text | #F7F0FC |
| Muted text | #B8ACC9 |

- Cinzel for premium display headings; Manrope for body text and interface elements. Host the approved fonts locally with their licenses.
- Centralize design tokens in `app/tokens.css` and reusable styles in the shared application stylesheets. Admin, client, and authentication layouts use the same system.
- Use subtle glass effects, dimensional gradients, refined copper borders, and restrained ambient glow. Primary actions use magenta → violet → cobalt gradients with readable text.
- Apply consistent styling across Command Center, Lead Intelligence, Project Pipeline, Client Portal, and all supporting screens. Preserve readable tables, forms, project details, and navigation.
- Use the original NHS logo assets from the approved logo kit without recoloring, cropping, redrawing, or filters. Preserve the heart, ring, and skeleton key. Render proportionally.
- Maintain responsive desktop and mobile layouts, visible keyboard focus, accessible control sizing, wrapping for long names and filenames, and reduced-motion support. Keep lead acquisition and scores visible on mobile.
- Treat this as an application-wide theme correction. Preserve routes, business logic, Supabase configuration, authentication, permissions, migrations, and all existing records. Existing planned modules retain their feature scope.

### Implementation and verification status — October 12, 2026

The theme is implemented locally on `theme/nocturne-electric` at commit `3f66c948d2b532374d4ccba225713d75e03c9ce4`; this blueprint update does not publish the application.

- Existing `npm run typecheck`, `npm run build`, and `npm run verify:flowkeep` checks passed.
- Reviewed 16 desktop/mobile screenshots covering Command Center, Lead Intelligence, Project Pipeline, Client Portal, lead details, client project details, sign-in, and unauthorized screens.
- Audited 32 layouts at 320px, 390px, 768px, and 1440px widths: no horizontal overflow; all fonts and logo images loaded.
- SHA-256 comparisons confirmed sidebar, sign-in, and favicon artwork match the supplied logo kit byte-for-byte.
- Screenshot review used actual application components with synthetic data and inert forms. It verifies presentation and responsiveness; it does not replace live authentication, permission, data-integrity, or backend verification.
- No production data queries, database writes, publication, deployment, or production migration were performed for the theme correction. Preserve the migration rule below.

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
