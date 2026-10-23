# NHS Nocturne visual preview: self-contained offline repair

## Observed failure
After extracting the corrected ZIP to a Windows Downloads folder, the user saw an entirely blank preview frame while opening the index via file://. The previous relative path fix did not resolve the file-protocol iframe issue.

## Changes
- The preview generator embeds its 30 source-rendered synthetic screens and processed CSS within index.html as JSON script data.
- A restricted, script-disabled iframe now uses srcdoc, not a local file URL, when switching Admin/Client, screen and viewport.
- JSON escapes <, > and & to prevent the React HTML payload from terminating the inline JSON script.
- Existing frames and visual.css are retained as auditable supplementary files, but index.html no longer depends on them.
- An automated verifier checks screen completeness, styles, no external resources and no production identifiers.
- A new desktop and mobile Playwright regression test opens the actual file:// index and confirms that Admin home, Client home, Client project and view switching render without network requests.

## Boundaries
The synthetic preview remains a read-only design demonstration. No client data, Supabase authorization, storage, scanner behavior, Cloudflare Worker, login, payment, live action or production deployment is changed. Keep the release draft and require visual approval before merge/deploy.
