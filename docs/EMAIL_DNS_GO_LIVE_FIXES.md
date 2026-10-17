# NHS OS go-live email DNS audit — October 17, 2026

**STATUS: READ-ONLY FINDINGS — NO DNS CHANGES AUTHORIZED OR EXECUTED**

Cloudflare zone `ninthheartstudios.com` is active. The audit used read-only Cloudflare DNS listing; it does not prove actual mail submission, receipt, provider verification or mailbox delivery.

## Confirmed records requiring human/provider review

At `_dmarc.ninthheartstudios.com` the zone currently lists **three TXT records** beginning `v=DMARC1`:

1. `v=DMARC1; p=none;` (added October 16)
2. `v=DMARC1; p=none; rua=mailto:dmarc-reports@ninthheartstudios.com` (older)
3. `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;` (older)

The same name also has a **proxied CNAME to `_dmarc.wixemails.com`**. Multiple DMARC policies at one owner name mean DNS DMARC policy discovery cannot select one valid policy; CNAME/TXT coexistence at the same name also conflicts with DNS naming rules. See RFC 7489 Section 6.6.3 and RFC 2181 Section 10.1.1.

At the root domain `ninthheartstudios.com`, inbound MX records include:
- Google Workspace: `aspmx.l.google.com` (priority 1), `alt1` and `alt2` (priority 5), `alt3` and `alt4` (priority 10).
- **Also** `inbound-smtp.us-east-1.amazonaws.com` (priority 10, added October 16).

The extra AWS inbound MX can participate in mail routing under failure/availability conditions. Do **not** remove it until the owner confirms whether it is deliberately handling messages for the root domain; do not change Google's MX, SPF, or mailbox routing based on this report.

The `notify.ninthheartstudios.com` sending subdomain contains two Resend-related CNAMEs (`rsend.notify`, `send.notify`) and a Resend DKIM TXT (`resend._domainkey.notify`). These records **exist**, but a verified Resend domain, correct Supabase SMTP configuration, and end-to-end delivered password recovery have **not** been verified.

## Recommended change plan — NOT EXECUTED

1. **Determine mail ownership.** Confirm that Google Workspace is responsible for all `@ninthheartstudios.com` inbound email and whether Amazon SES inbound receiving is intentionally configured at the root. Confirm whether Wix email marketing needs its `_dmarc` CNAME.
2. **Choose one DMARC policy in provider UI.** Coordinate the surviving TXT policy with Google Workspace and Resend sending domain alignment; maintain a single `v=DMARC1` TXT record at the _dmarc hostname and no conflicting CNAME. A cautious initial monitoring policy and a later stricter policy must be deliberately selected based on provider configuration; this report does not prescribe silently weakening/strengthening DMARC.
3. **Remove only confirmed stale/conflicting records**, after explicit authorization to edit DNS and an export/snapshot of all current records. Preserve root Google Workspace MX and verified mail sender SPF/DKIM; take extra care with records in use by Wix or SES.
4. **Verify after propagation** with a public resolver: exactly one valid DMARC policy, no CNAME collision, expected SPF and aligned DKIM for the actual From domain, and root MX priorities consistent with the chosen inbound provider.
5. **Verify Resend and Supabase** in authenticated provider dashboards: `notify` sending domain verified, sender address authorized, Supabase custom SMTP enabled, correct production Site URL + recovery redirect and email template.
6. **Prove delivery with an owned disposable mailbox.** Request a single reset message, confirm a fresh mail delivery event in Resend, follow the link to the HTTPS NHS OS host, reset the disposable password, sign in with the new password, test reused/expired links, and check that the correct user role persists. Do not change customer accounts or publish sensitive tokens in chat/logs.
7. **Reverify GitHub production release environment and restorable backups** separately before any production security migration or Worker deployment.

## Why this matters

A passing application build and existing DNS records do **not** establish reliable outbound email. RFC 7489 DMARC lookup terminates without applying a policy when more than one DMARC record remains; RFC 2181 forbids a CNAME from sharing a label with ordinary DNS records.

**No automated workflow should remediate these DNS entries without a provider ownership decision and owner approval.**
