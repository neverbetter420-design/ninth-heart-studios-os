# Shine Build Specs — Post-Roadmap Features

**Status:** DRAFT specs (Oct 12) — **updated Oct 14:** specs **2** (contracts + e-signature)
and **5** (revision rounds + change orders) have **SHIPPED**. **Square CHOSEN Oct 13** for
payments + billing (Stripe permanently out); billing still goes LAST per her roadmap. The
build queue is otherwise Hailey's to call — these specs are reference, not a schedule.
Do not re-pitch; she says go.
**Why this exists:** On Oct 12 Hailey asked NOX to research high-rated freelancer-app features
(~40 sources: HoneyBook, Dubsado, Moxie, Bonsai, Copilot, freelancer communities — full report
in the `nhs-os-feature-research` artifact). She then said *"choose all that makes shine."*
These are the picks, scoped against the actual repo (audited Oct 12 night — the research
report's have/gap labels were based on conversation, not the repo, so every spec below
re-checks what exists).

**Standing rule honored:** stability-first. These wait until the current build runs smoothly.
Build order below is a recommendation, not a schedule — Hailey says go, one spec at a time.

**What the repo already has (audited Oct 12, updated Oct 14):**
- `proposals` table: id, opportunity_id, title, content, status (`draft`/`sent`) — admin-only
  (Phase 6).
- **SHIPPED Oct 13 — spec 2:** `contracts` table (body, status draft/sent/signed/voided,
  signed_at, signer_name/email, signature_hash, signer_ip), `/contracts` admin, portal
  signing (`ContractSign`), click-to-accept e-signature (typed name + email + checkbox),
  signature audit (timestamp + IP + SHA-256 of body::email::timestamp), document-integrity
  DB triggers, Master Templates (`templates` table, contract|document) wired into contract
  creation. Starter library seeded: standard agreement, welcome packet, handoff doc.
- **SHIPPED Oct 13 — spec 5:** revision rounds + change orders (`20261013033207` migration).
  Visual feedback pins (comment-on-the-work) NOT built.
- **Shipped Oct 13:** fillable Forms builder (`form_templates`/`form_submissions`, 8 field
  types incl. line_items + signature) + PDF import pipeline (AcroForm + heuristics,
  review-before-activate).
- Phase 4: projects, milestones, client approvals, file uploads.
- Phase 5: per-project client portal (message threads + shared documents).
- Phase 7: deterministic Muse engine (priority explainers, project risk, stale leads,
  next-action recommender, draft composer) — **no LLM, no send path by design**.
- Phase 8: automation registry (4 automations, seeded OFF), `automation_runs` audit trail,
  in-app admin-only `notifications`. Integrations page: Email / Calendar / Invoicing-payments /
  Lead-sources all **Not connected** — each needs a provider + key from Hailey.
- Care plans exist as offerings (Pulse $199/mo, Inferno $399/mo) with **no billing system**.

---

## Build order

**Oct 12 update — Hailey reordered: billing goes LAST.** Sequence was: **5** → **2** →
**6** → **3 + 4** → **1**. **Oct 13–14 update:** specs 5 and 2 have shipped (see notes).
Remaining order when she calls it: **6** (white-label — gated on productization) →
**3 + 4** (Smart File, care-plan kit — require billing) → **1** (billing — Square, last).

### 1. Invoicing + online payments + recurring billing — the money core

**Why it shines:** Every review of every competitor says the same thing: invoicing and
collections are where freelancer tools win or die. Hailey's care plans (Pulse/Inferno) can't
become real MRR without card-on-file billing. This unblocks specs 3 and 4.

**Exists today:** nothing. No invoice tables, no payment flow, no billing UI.
**New:**
- Tables: `invoices` (id, project_id/client, line items JSON or `invoice_lines`,
  amount, due_date, status: draft/sent/paid/overdue), `payments` (invoice_id, provider,
  provider_payment_id, amount, status), `subscriptions` (client_id, plan: pulse/inferno,
  provider_subscription_id, status, current_period_end).
- Admin: `/invoices` page — create from project milestones, send (via Email integration
  once connected; until then, copy-link), mark paid, retry failed.
- Portal: client-facing pay view (token link, no login required) — card/ACH.
- Automations: new registry entries — invoice reminders (due-soon/overdue), dunning
  sequence for failed subscription payments (payment provider handles retries; OS surfaces status).
**Provider decision — DECIDED Oct 13:** **Square** for payments + billing (Stripe ruled
out Oct 12, permanently). Needs her Square account + sandbox keys when billing time comes.
Billing goes LAST per her roadmap — do not start until she calls it.
**Unlocks:** care-plan MRR, milestone-based billing, specs 3–4.

### 2. Contracts + e-signature — the insurance policy — ✅ SHIPPED Oct 13

**Why it shines:** "Contracts with e-signature" is a top-4 praised category across all
competitor reviews. Verbal agreements are the freelancer's original sin.

**Exists today:** `proposals` (content field) can hold contract *text*, but there is no
contract object, no signing flow, no signature record.
**New:**
- Table: `contracts` (id, project_id/opportunity_id, template_id, body, status:
  draft/sent/signed/voided, signed_at, signer_name, signer_email, signature_hash, ip).
- Admin: `/contracts` — generate from template (reuse proposal workspace), send signing
  link, track status.
- Portal: signing view — read, typed/drawn signature, download PDF copy.
**Decision — DECIDED + SHIPPED Oct 13:** in-app click-to-accept (typed name + email +
checkbox), free, no new vendor. Audit trail: timestamp + IP + SHA-256 document hash.
Document-integrity triggers guard signed contracts at the DB layer. Third-party
(DocuSign/Dropbox Sign) deferred unless a client demands it.
**Unlocks:** spec 3 (the Smart File).

### 3. Smart File — proposal + contract + invoice, one doc, one signature, one payment

**Why it shines:** HoneyBook's Smart File is the single most-loved feature across every
freelancer-tool review analyzed. Nobody in the own-your-data / custom-build space has it.
This is the headline feature for both her studio *and* the future product.

**Exists today:** proposals (drafts), contracts (spec 2), invoices (spec 1) — three
separate objects with no combined client experience.
**New:**
- Concept: a `smartfiles` record composing one proposal + one contract + one invoice
  (deposit or full) into a single client-facing document with ordered actions:
  review proposal → sign contract → pay.
- Portal: `/portal/file/[token]` — branded, step-progressed, mobile-first. One link does
  the whole close.
- Admin: compose view linking the three objects; status timeline
  (viewed → signed → paid); Muse draft-composer can pre-write the cover note.
**Depends on:** specs 1 + 2. This is deliberately third.
**Unlocks:** the fastest lead-to-cash flow in the app; the product's demo moment.

### 4. Care-plan productization kit — pause / upgrade / dunning / self-serve billing

**Why it shines:** Nobody packages recurring care plans properly for designers. With spec 1
done, this turns Pulse/Inferno from invoices she chases into subscriptions clients manage.

**Exists today:** care plans are prices in memory, not objects. No subscription table.
**New:**
- Extend `subscriptions`: pause/resume, plan change (pulse ↔ inferno), cancel with
  end-of-period.
- Portal: self-service billing page — update card, see invoices, pause/upgrade.
- Automations: dunning nudges (in-app notification + email when connected), failed-payment
  flags on the Muse delivery radar.
**Depends on:** spec 1 (subscription billing).
**Unlocks:** real MRR with near-zero admin; a packaged feature competitors don't offer.

### 5. Revision rounds + visual feedback + change orders (+ AI scope-creep guard) — ✅ SHIPPED Oct 13 (revision rounds + change orders; visual feedback pins NOT built)

**Why it shines:** The designer moat. No CRM does this: clients comment *on the work*,
revisions are counted, and out-of-scope requests become priced change orders in one click.

**Exists today:** Phase 4 client approvals (approve/request-changes, no round counting);
Phase 5 shared documents; no visual commenting, no change orders.
**New:**
- Tables: `revision_rounds` (project_id, round_number, status, included_rounds from the
  package), `feedback_pins` (round_id, page_url/screenshot ref, x, y, comment, resolved),
  `change_orders` (project_id, description, fee_impact, timeline_impact, status:
  draft/proposed/approved/declined).
- Project page: revision tracker (round 2 of 3 included), visual feedback view on shared
  deliverables, "convert to change order" on any feedback item.
- **AI scope-creep guard (deterministic, Phase-7 style):** Muse compares a client request
  (portal message / feedback pin) against the project's scope text and flags likely
  out-of-scope items with a drafted change order. No LLM needed for v1 — keyword +
  scope-match heuristics over data she already has; LLM upgrade optional later.
  (Built: scope corpus is composed live from project name + internal notes +
  milestone/task titles + document titles — no new `scope_text` column.)
**Depends on:** nothing new — builds on Phases 4–5. Could be built before specs 1–4 if
she wants the moat first.
**Unlocks:** fewer unpaid revisions, paid scope changes, a story no competitor tells.

### 6. True white-label portal — the productization flex

**Why it shines:** Copilot charges $59+/mo for white-label portals. Bundled into a
productized NHS OS, it's the trust story (client-data isolation, already audited) made
visible.

**Exists today:** portal is per-project under her domain with NOCTURNE ELECTRIC identity;
branding is single-tenant (PARTIAL in the research matrix).
**New:**
- Per-studio branding record (logo, colors, studio name, custom subdomain mapping);
  portal renders the studio's brand, not NHS's.
- Admin: brand settings page; subdomain provisioning notes.
**Depends on:** the productization decision (multi-tenancy, pricing/packaging) — this is
explicitly a *sell-it* feature, not a *run-her-studio* feature. Spec it now, build it
when the product decision is made.
**Unlocks:** the freelancer-product tier.

### 7. AI-native assistant upgrade (optional, later)

**Why it shines — already mostly shipped:** Phase 7's deterministic Muse covers priority
explanation, risk summaries, stale leads, next-action recommendation, and draft
composition — the substance of "AI-native assistant" with zero cost and zero hallucination
risk. The research-noted gap (AI notetaker, email drafts, MCP/connector) is the remainder.
**When to revisit:** only if she wants free-text reasoning over her data (needs LLM
provider + API key + budget — her call, per the Oct 12 thread) or external connectors
(MCP/Claude/ChatGPT). Not a gap worth filling while deterministic covers the jobs.

---

## Explicitly deferred (from the 20-feature matrix)

- **One-click time → invoice / effective hourly rate / expense-P&L-tax:** no time tracking
  exists; valuable but a separate product surface. Revisit if she wants it.
- **Scheduling + upfront payment:** needs Calendar integration (Google OAuth) + spec 1.
  Small spec when she's ready.
- **Testimonial capture, support tickets, multi-stakeholder projects:** nice-to-haves;
  portal messages cover the 80% case today.
- **AI notetaker / email drafts:** covered in spirit by the draft composer; true notetaking
  needs call integrations she hasn't asked for.

## Decisions that stay with Hailey

1. Build order and timing (stability-first stands — specs ≠ schedule; queue is hers to call).
2. Payment provider: **Square chosen Oct 13**; Square account + sandbox keys needed when billing time comes (billing LAST).
3. E-signature path: **decided + shipped** — in-app click-to-accept (spec 2).
4. Email provider (Resend suggested on the integrations page) — needed for invoice/contract
   sending and dunning.
5. Productization go/no-go — gates spec 6.
