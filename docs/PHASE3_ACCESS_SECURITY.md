# Phase 3: client memberships, approvals, and RLS release gate

## Safety boundary

Phase 2 was confirmed as 10/10 green on manual write-QA run #39021575467. An independent SQL read after that run found 2 original Client A tasks, no extra milestones/documents/files, no leftover QA storage objects, 1 existing membership, and 1 existing approval. QA activity/audit rows were retained.

**Phase 3 currently authorizes read-only inspection and test code only.** No changes to existing memberships, approval status or owners, customer data, Supabase schema/policies, live application deployments, or automations. Do not use `scripts/verify-security.mjs` as a Phase 3 read-only test: that older script contains a disallowed UPDATE probe. No service-role key is needed for new read-only tests.

## Live policy inspection on 2026-10-17 (read-only)

Supabase project `ninth-heart-studios-os` (`rquscwgdrqkzwjukiqtk`) currently has RLS enabled on `clients`, `client_memberships`, `projects`, `tasks`, `milestones`, `documents`, `files`, `approvals`, `messages`, `leads`, and `profiles`. The membership and project SELECT predicates depend on `auth.uid()` / `private.can_access_client` / `private.can_access_project`. Task SELECT requires `client_visible=true`.

The exact test fixtures are:

| Fixture | Project ID | Client ID | Existing approval | Internal task |
|---|---|---|---|---|
| Client A Test Co. Website | `fdb531db-bf9c-47ee-bc6a-458b626665a2` | `90d03d98-4e1d-4240-8f01-aba182e041ce` | Yes (pending) | Yes |
| Client B Test Co. Website | `ec3c2fb4-8e10-423b-8199-eaa7e6f8259d` | `5a3164bf-e300-4948-bda6-8ffed74448b7` | Yes | Yes |

## Security concerns requiring a controlled migration before production release

**Approval mutation scope:** `public.approvals` has a client UPDATE RLS policy, `Clients decide own pending approvals`, that uses old-row `status='pending'` and own-project access, and checks new `status IN ('approved','declined')` and own-project access. Live column-privilege inspection showed authenticated users have UPDATE privilege on `id`, `project_id`, `title`, `requested_by`, `requested_at`, `decided_by`, `decided_at`, `client_comment`, `created_at`, and `updated_at`, not merely a subset. That policy doesn't itself prevent changes to title/other approval metadata on a legitimate pending approval. This is a verified **policy design gap**, not a demonstrated exploit. Fix with an approved migration constraining non-admin transitions, ideally in a database trigger that compares OLD/NEW, rejects edits to immutable fields, enforces `decided_by=auth.uid()`, and timestamps the decision server-side. Application-side form validation alone is inadequate against direct API requests.

**Message sender identity:** `Clients send project messages` INSERT policy currently checks own-project membership but does not itself check `sender_id=auth.uid()`. Live column privileges allow authenticated callers to populate `sender_id`. Strengthen the INSERT RLS policy for non-admin senders to include `sender_id=(select auth.uid())`; admins retain their separate policy. This is a verified **policy design gap**, not a demonstrated spoofing attempt.

Neither database remediation is authorized or applied yet. Preserve existing data and policies until migration testing can be done safely with a disposable isolated database.

## Added read-only tests

`tests/e2e/phase3-access.spec.mjs` does not invoke INSERT/UPDATE/DELETE/Storage writes. It:

1. Signs in as each existing test client using GitHub secrets and a publishable Supabase key; verifies they read their own project/client/membership and cannot see the other client's IDs.
2. Checks cross-client `tasks`, `milestones`, `approvals`, `documents`, `files`, and `messages` via direct authenticated Data API queries. Both fixtures have an existing approval, so that isolation assertion has substantive coverage.
3. Checks client-visible task reads, admin-only leads isolation, and that each client can read only its own profile record.
4. Checks direct project links in the browser: own project shows heading; other client's project shows the generic not-available screen.
5. Confirms the test admin can read both fixture projects and approvals without modifying either.

This is **not** a proof that all possible user mutation or storage policy paths are secure. Read-only tests cannot exercise permission revocation, approval decision writes, message spoofing attempts, or pending approval immutable-field enforcement. Dedicated disposable fixtures and explicit additional approval are required for those tests.

## Release checklist

- [ ] PR browser/TypeScript/Cloudflare CI green on the latest snapshot.
- [ ] Protected manual authenticated run of the Phase 3 read-only test succeeds on both desktop and mobile.
- [ ] Independent Supabase query confirms memberships and approvals unchanged.
- [ ] Design migration that enforces client approval immutable fields and message sender identity; test away from production.
- [ ] Obtain explicit approval before schema/migration execution, membership mutation, approval writes or deployment.

No Phase 3 code is merged or deployed by creating this document.
