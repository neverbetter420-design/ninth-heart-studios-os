# NHS OS · Ninth Atelier typography direction

**Draft branch only**: `design/nhs-at2-background-handoff-20261117`.

## Typeface assignments

| Visual role | Requested typeface | Implementation |
| --- | --- | --- |
| Main hero, page and room headers | **Single Ghost** | `--nhs-font-display`, large `h1/h2` headings |
| Section, panel, feature and card titles | **Anger Styles** | `--nhs-font-title`, scannable `h3/h4` title selectors |
| Reading text, form inputs, buttons, navigation, data labels and numbers | **DM Sans** | `--nhs-font-reading`, existing accessible body font |

Styling is scoped to the living NHS OS room shell, not the unrelated marketing website. Keep asymmetric layouts, very transparent 28px frosted-glass panels, complete stationary full-frame background art, keyboard access, and readable contrast.

## Uploaded file inspection

- `SingleGhost regular.ttf`: family **SingleGhost regular**, PostScript **SingleGhostregular**, Regular, 310 mapped Unicode glyphs, SHA-256 `260100b5bd689c59da94aa176f611828281f88e01d7b071e66b26cf25301f08b`.
- `AngerStyles.ttf`: family **Anger Styles**, PostScript **AngerStylesRegular**, Regular, 160 mapped Unicode glyphs, SHA-256 `fd7505b27f86ef36f112340edd36f20f07ec9b7c172da190a63cc2c380e096ef`.

**The uploaded font binaries are not in the GitHub repository.** `app/living-atelier-typefaces.css` only resolves already-installed local copies through `src: local(...)` and falls back to Cinzel, Georgia and DM Sans on other machines. This is an intentional preview, not production-ready cross-device font hosting. Do not put the uploaded TTFs or derived WOFF2s into the public assets directory or an image/font ZIP until licensing has been verified.

## Licensing and release gate

- Single Ghost's font metadata indicates **preview-and-print embedding** (fsType=4), not a confirmed web-embedding license. The designer sells a commercial license: `https://www.creativefabrica.com/product/single-ghost/`.
- Anger Styles is listed as **free for personal use only**, with a commercial-use inquiry: `https://www.dafont.com/anger-styles.font`.
- Confirm that the licenses held by the studio cover **commercial web use, the app domain, and self-hosted font embedding/conversion** before shipping webfont binaries. A local desktop font or unrestricted OS/2 flag alone does not constitute webfont permission.
- Until that gate, no public font files, self-hosted `url()` sources, CSS data URIs, or third-party CDN for these fonts. Existing Cinzel and DM Sans remain as safe fallbacks.

## QA

- The CSS is imported after `living-atelier-crystal-glass.css`; existing routes and permission checks remain unchanged.
- Desktop/mobile browser test checks declared font-family mapping and horizontal overflow. Browser-computed family declaration is not proof the commercial font glyphs loaded; confirm actual rendered font only when locally installed and licensed.
- Check special glyphs, long client names, line wraps and text contrast at 320, 390, 740, 1024 and 1440px before activation.
- Do not change the original NHS logo or turn decorative letterforms into unreadable body copy.

**State:** typography assignments prepared and active for local-font preview in the draft; production font embedding not approved or deployed.
