# Offline preview: direct in-page rendering fix

The user submitted a third screenshot of an extracted local file:// index with a blank white iframe. The old generated HTML had no visible app content without JavaScript and relied on iframe behavior; earlier relative-path and srcdoc fixes still failed in the user's Windows Chrome.

The new index starts with real source-rendered Admin home markup inside the visible <main id="preview">. It embeds all 30 synthetic source-rendered Admin and Client screens in inert HTML templates with the visual CSS inline. Native select controls clone the chosen template into the same visible surface, never load iframes, and retain a standalone fallback link. The Admin home remains fully visible with JavaScript disabled.

The verification script requires 30 safe templates, initial visible Admin content, all CSS embedded, and no iframes. A new Playwright test opens actual local file:// index in Chromium, checks Admin and Client switching, verifies real ivory background at Admin client-detail and checks disabled JavaScript. The preview remains a read-only synthetic demonstration with no live credentials or production connections. Keep PR #21 as draft.
