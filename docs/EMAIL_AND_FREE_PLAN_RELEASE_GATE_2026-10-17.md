# NHS OS email and Free-plan release acceptance gate

**Reviewed October 17, 2026. Status: NOT CLEARED FOR PRODUCTION CHANGES.**

This is a checklist for the owner to review authenticated provider settings. It does **not** install credentials, send a reset message, modify a live account, alter the database, or deploy the Worker.

## Verified read-only facts

- Cloudflare DNS cleanup was completed: the `notify` sender CNAMEs and other sender records are **DNS-only**, required Resend DKIM TXT entries exist, only one monitoring-policy DMARC record remains, Google Workspace MX records remain, and the Amazon SES inbound MX is absent. DNS records by themselves **do not prove** Resend account-side domain verification or delivered mail.
- NHS OS source has password-reset action `app/auth/forgot-password/actions.ts` with `resetPasswordForEmail` using `https://app.ninthheartstudios.com/auth/reset-password?recovery=1`; server callback `app/auth/callback/route.ts` supports `verifyOtp({token_hash,type})`; reset-password page requires 12+ characters. `npm run verify:password-recovery` passes in CI.
- Live Worker last observed Cloudflare deployment **2026-10-16 20:04:57 UTC**. A passing GitHub PR is **not proof** that recovery code is deployed.
- Connected Supabase organization plan is **Free**; automatic downloadable backups are not included. The database read-only query on October 17 measured about **13 MB**, **4 auth users**, **1 Storage object**, and **22 applied migrations**. Source proposes security migration `20261017030000_phase3_client_decision_sender_guard.sql` but it is **not yet applied**.
- Auth logs and public DNS checks alone cannot reveal the configured SMTP password, verified sender-domain state, full delivery events, or a successfully used recovery link. A Gmail search found no independent recovery message confirmation. Do not claim the email gate is complete.

**Owner confirmation (October 17, 2026):** The owner reports that Resend displays **Verified** for `notify.ninthheartstudios.com`. This is a user-confirmed provider UI status, not an independent authenticated Resend API check. **Gate A is only partially complete** until the SMTP integration settings, approved From address, and controlled delivery event are checked. No credentials are needed in this document.

## Gate A: Verify Resend as sending provider (owner/provider UI)

1. Open [Resend Domains](https://resend.com/domains). Open the exact **`notify.ninthheartstudios.com`** sender-domain entry and confirm that its status says **Verified**. If not, use Resend's generated DNS requirements; do not invent DKIM/SPF/MX values or alter Google's root MX records.
2. In [Resend SMTP](https://resend.com/settings/smtp), use the authenticated provider settings, not chat, to manage the key. The documented settings are **host `smtp.resend.com`, port `465` (or provider-supported alternative), username `resend`, password = Resend API key**. Never paste or upload keys, real passwords or raw email tokens to issues or ChatGPT.
3. Make sure click/open tracking or link rewriting is disabled for one-time password-recovery messages.
4. Use [Resend Emails](https://resend.com/emails) to verify the test message reached an actual **delivered** status. A successful request or Supabase event `mail.send` is not a delivery receipt.

## Gate B: Verify Supabase Auth email setup (owner/provider UI)

1. Open [Supabase Auth SMTP](https://supabase.com/dashboard/project/rquscwgdrqkzwjukiqtk/auth/smtp). Ensure **custom SMTP is enabled**, and provider is Resend or its native integration, with **verified sender** (recommended `auth@notify.ninthheartstudios.com` only if authorized in Resend). Sender name should read `Ninth Heart Studios`.
2. Open [Auth URL configuration](https://supabase.com/dashboard/project/rquscwgdrqkzwjukiqtk/auth/url-configuration). Set Site URL to `https://app.ninthheartstudios.com`, and allow the exact app reset URL `https://app.ninthheartstudios.com/auth/reset-password?recovery=1`.
3. Open [Auth Email Templates](https://supabase.com/dashboard/project/rquscwgdrqkzwjukiqtk/auth/templates) and inspect **Reset Password**. The proposed server-verified link is:

```html
<a href="{{ .SiteURL }}/auth/callback?flow=recovery&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

This uses the real Supabase token-hash variable and the app's existing server callback, avoiding dependence on a browser-local verifier. If the provider UI currently sends a different link, review the deployment and redirect rules **before changing** the template. Updating the live Auth template is a production settings change and needs explicit authorization.
4. Supabase's built-in SMTP is for development and subject to production restrictions; client onboarding must not rely on it.

## Gate C: Controlled real-mail test

After confirming A and B, invite or use only an **approved, real, controlled test mailbox** that is already an authorized NHS OS Auth user (not a customer's account), and explicitly authorize the reset test.

1. Submit a single recovery request at `https://app.ninthheartstudios.com/auth/forgot-password`.
2. Verify delivery in Resend and check the mailbox; do not repeatedly request links.
3. Use the latest received link on another device/browser to set a NEW 12+ character password. Sign in to verify role permissions; test expired/reused link and request-new-link UI.
4. Inspect Supabase Auth logs for delivery errors and recent status. Do not paste real links or tokens into chat or CI logs.
5. Do not infer success from the `sent=1` screen. Code intentionally returns the same message for known and unknown addresses.

## Gate D: Pre-migration backup on Supabase Free

The current plan has no guaranteed **downloadable automatic database backup**. Before any new live migration either:

- **Option 1:** Upgrade the Supabase project with the owner's explicit approval of subscription cost, confirm a restorable backup exists for the **exact** project and current point in time, and independently back up actual Storage file content; **or**
- **Option 2:** Produce an **encrypted manual logical backup** using Supabase CLI / `pg_dump` on a trusted local computer. Do not put database passwords in chat or terminal history, or commit database dumps to GitHub.

Supabase official backup guide: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

On the owner's machine, after installing the Supabase CLI and arranging private, authenticated database access, save **separate roles, schema and data** dumps:

```bash
# $DB_URL must be loaded securely from a local secret manager, never pasted
# into chat, source code, screenshots, or a shared terminal transcript.
umask 077
mkdir -p nhs-os-private-backup
supabase db dump --db-url "$DB_URL" -f nhs-os-private-backup/roles.sql --role-only
supabase db dump --db-url "$DB_URL" -f nhs-os-private-backup/schema.sql
supabase db dump --db-url "$DB_URL" -f nhs-os-private-backup/data.sql --data-only --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

**Limitations:** A default Supabase CLI dump excludes some managed `auth` and `storage` schema material; export appropriate managed-schema data and migration history separately using the *official* backup/restore guide, and test the intended restore procedure before claiming the backup is restorable. This database dump does **not** contain the bytes of Storage objects. The project currently has **1** object; download its actual contents separately through authorized Supabase Storage mechanisms and preserve its exact bucket and path with the encrypted backup. A reliable restore of an Auth project is not the same thing as restoring generic public tables.

Require positive checks: files nonempty, off-device encrypted retention in a private destination, the managed-schema/auth and Storage plan documented, restore-tested to an isolated environment or at least reviewed for exact recovery method. Do not publish backups as GitHub artifacts or commit them to this repository.

## Gate E: Separate production authorizations

Only after Gates A through D are evidenced should the owner separately approve:
1. Executing `20261017030000_phase3_client_decision_sender_guard.sql` on active Supabase, followed by **read-only** DB policy/trigger checks.
2. Merging reviewed draft PR #14 to main after exact-SHA CI passes.
3. Running the owner-only, manual Cloudflare production workflow on the reviewed main SHA, followed by live admin/client smoke and mail tests.

**No production database mutation, account resets, DNS edits, provider SMTP changes, git merge, or Worker deployment was carried out when authoring this checklist.**
