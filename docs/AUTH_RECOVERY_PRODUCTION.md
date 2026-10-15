# NHS OS: password recovery, email delivery, and deployment

Status reviewed October 15, 2026. **GitHub passing checks does not mean the Worker is deployed.**

## Verified state

- The public login and reset screens are served by `https://app.ninthheartstudios.com`.
- GitHub source: `neverbetter420-design/ninth-heart-studios-os`.
- Supabase project: `rquscwgdrqkzwjukiqtk`.
- Cloudflare Worker: `ninth-heart-studios-os`, deployed using **Wrangler** (not GitHub auto-deploy). Current production bundle predates password-reset fixes merged October 15.
- Supabase Auth logs show recovery `mail.send` events for earlier requests, but later requests can return HTTP 200 without a matching send event. Do not treat a form success screen or status 200 as proof an email was delivered.
- Google Workspace handles existing incoming domain mail. Its current DNS mail records must be preserved.

## 1. Set up transactional delivery via Resend (preferred)

Supabase offers a **native Resend integration** at https://supabase.com/partners/resend. This creates/configures the SMTP API key in Supabase without copying it into source code. The owner must authorize the provider connection.

1. Connect Resend to the specific NHS Supabase project, or configure it manually at https://supabase.com/dashboard/project/rquscwgdrqkzwjukiqtk/auth/smtp.
2. Verify a sender domain in Resend, ideally a **subdomain** dedicated to transactional mail (such as `notify.ninthheartstudios.com`) to avoid disturbing Google Workspace's MX, SPF, DKIM and DMARC records for the root domain. Use **exactly the DNS record names and values supplied by Resend** in Cloudflare DNS. Never replace Google's root MX records. Do not guess an SPF or DKIM value.
3. Configure a verified From address, e.g. `auth@notify.ninthheartstudios.com`, and sender name `Ninth Heart Studios`. The address must actually be authorized on the sending domain.
4. If configuring manually, Resend's SMTP host is `smtp.resend.com`, port `465` (TLS/SSL), username `resend`, and password is a **Resend API key**. Store it **only in Supabase SMTP settings**, never in GitHub, frontend code, or chat.
5. Disable click/open tracking on password-recovery messages. Email scanners and link rewriting can invalidate one-use links.
6. Verify provider activity for **accepted, delivered, bounced, and suppressed** messages; `mail.send` by itself is not a delivery receipt.

**Credential/action needed at this step:** Authorize the Resend-to-Supabase integration and verify the sending domain in the provider UI. If using manual SMTP instead of the native integration, obtain a Resend API key and enter it directly into Supabase SMTP settings. No credentials should be pasted into chat.

## 2. Confirm Supabase redirect and template configuration

At https://supabase.com/dashboard/project/rquscwgdrqkzwjukiqtk/auth/url-configuration:

- Site URL: `https://app.ninthheartstudios.com`.
- Redirect allow-list: `https://app.ninthheartstudios.com/auth/reset-password?recovery=1`.
- Optional local development: `http://localhost:3000/auth/reset-password?recovery=1`; only include if testing locally.

At **Authentication > Email Templates > Reset Password**, retain the brand markup but change the recovery link to a one-use token-hash callback supported by the app:

```html
<a href="{{ .SiteURL }}/auth/callback?flow=recovery&amp;token_hash={{ .TokenHash }}&amp;type=recovery">
  Reset your password
</a>
```

This callback verifies the token server-side and works across devices without relying on browser-local PKCE verifier storage. Do not change unrelated templates or open public signup.

**Access required:** An authorized Supabase owner/admin sign-in (in the dashboard, not in chat).

## 3. Deploy the verified production Worker safely

GitHub now contains a fully reproducible OpenNext/Cloudflare Worker build:

- `wrangler.jsonc`: correct `ninth-heart-studios-os` name, current compatibility date/flag, `ASSETS` binding and `keep_vars: true` to preserve dashboard environment values.
- `open-next.config.ts` and locked dependencies in `package-lock.json`.
- `npm run cf:build`: compiles the actual Cloudflare Worker bundle.
- `npm run cf:dry-run`: validates the bundled Worker without publishing.
- `.github/workflows/verify-cloudflare.yml`: repeats both checks on pull requests and main.
- `.github/workflows/deploy-cloudflare.yml`: **manual dispatch only**, with a preflight; never deploys just because code is pushed.

**Production credential/action needed:** Create a scoped Cloudflare API token with Workers edit/deploy permissions for this account. Add it to the **production GitHub environment** as the secret `CLOUDFLARE_API_TOKEN`. The non-secret account ID is already configured in the deploy workflow.

**Do not start the workflow until Supabase custom SMTP, URL settings and the recovery email template have been checked.** Cloudflare's deployment is a production change. Trigger **Actions > Deploy NHS OS to Cloudflare (manual) > Run workflow** using `main` only after approval. The workflow verifies TypeScript and password recovery, builds the OpenNext bundle, performs a Wrangler dry-run, and deploys the **same** Worker name and asset binding.

The existing Cloudflare dashboard Worker custom domain `app.ninthheartstudios.com` must remain attached. `keep_vars` prevents the known `NEXTJS_ENV` dashboard binding from being replaced. Confirm original Cloudflare Worker settings and latest deployment timestamp immediately after release. If in doubt about runtime permissions or bindings, do not publish.

## 4. Smoke test with an invited test account only

- Create/use a controlled account with a **real, owned, deliverable mailbox**, not `example.com` seed addresses.
- Submit `/auth/forgot-password` once, then verify Supabase log and **Resend delivery status** for that request. Respect Supabase rate limits between requests.
- Follow the newest email's link and set a new 12+ character password; verify sign-in with the new password works, and the user stays in the correct admin/client role.
- Attempt direct `/auth/reset-password` without a link, and open an expired/used link: both must show a request-new-link path.
- Do not change the existing live admin password or clients' accounts to perform this test.
- If email isn't received, inspect Auth SMTP errors and Resend's delivery/suppression report. Don't keep submitting resets blindly.

## What must never be supplied in chat

Supabase service-role/secret keys, Resend API key, Google Workspace app password, Cloudflare API token, real user passwords, recovery links or tokens. Configure them in each provider's authenticated secret/settings UI. The project URL, publishable key and Cloudflare account ID are *not* secrets.
