# Nocturne — Muse and Settings

Muse now has an open editorial welcome, a single studio-focus recommendation, separate priority explanations and project-risk rows, an optional quiet-lead disclosure, a writing area and a saved-draft directory. Local destinations make each working area reachable without a wall of cards. Saved drafts open to show the complete stored text before Copy, Archive or the existing individual Gmail send controls.

The recommendation is withheld when lead, opportunity, project or project-risk reads are incomplete. Missing data is not described as an empty or healthy studio. Successfully read project risks are sorted by severity so a critical project does not sit behind a more recently updated watch-level project. The existing deterministic ranking, draft generation and risk rules are unchanged. The eight-project check window and ten-draft display limit are visible. Available targets remain usable when another target source fails; unavailable URL targets do not produce an unrelated draft.

Draft generation uses the existing GET route; saving and archiving retain the original server actions. Editors and dropdowns have explicit accessible names. Pending buttons describe in-flight actions without asserting a persisted result. The saved-draft list shows the stored subject/body, and its copy control copies that stored text. Gmail sending remains a separate disclosure, recipient field and explicit confirmation for one saved draft. It is only shown when the existing shared email-configuration check succeeds. This phase does not call the send action or send any external messages.

Settings is a read-only status view with Studio & Account, Connections and Controls destinations. Database status reports the actual scoped profile-read result. Gmail reports configuration presence, without claiming tested delivery or exposing settings values. Hosting describes the separate manual release process rather than claiming a verified deployed build; payments are described as separate setup. The page links to client access, Muse, automations and templates. It does not edit configuration or enable anything. Unsupported claims that safeguards are always on or automation rules are all off were removed.

The composition lives in `app/nocturne-studio.css`, extending the existing management canvas with fine rules, Georgia headings, restrained plum accents, readable fields, 44px controls and narrow-screen layouts. The original NHS logo geometry is unchanged.

## Verification

Source-rendered browser cases use in-memory fixtures and deny network requests. They cover 320–1440px widths, long unbroken lead/project/draft/account text, empty states, target/priority/risk/draft read failures, unavailable targets, generated drafts, highest-risk selection, native keyboard disclosures, configured/unconfigured email branches and accurate read-only settings. Sending is only inspected as markup; it is never submitted.

The strictly guarded disposable-local Supabase walkthrough additionally uses the real Muse GET composer, edits and saves a draft, reads back its kind/body/project/status, reloads and reviews it, then archives it and verifies its removal from the active list. It checks Settings against the local profile read, captures desktop/mobile previews at scroll position zero and asserts no send disclosure is available. No Gmail credentials are supplied to that job. Existing document, portal, lead and relationship checks remain.

Final-commit CI results are recorded in draft PR #14. Synthetic previews and automated checks are review evidence, not owner visual acceptance.

## Release boundary

Draft PR #14 only. No merge/deploy, hosted writes, migrations, configuration changes, automation activation or external messages. The verified-backup and distinct production approval gates still apply.
