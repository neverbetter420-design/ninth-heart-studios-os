# NHS OS · The Ninth Atelier | Eight full-frame backgrounds

**Status:** Eight exact WebPs imported into draft; five protected room backgrounds plus desktop/mobile sign-in are activated in draft CSS only, pending real-app screenshot approval. No staging/production changes.

## Approved visual rule
Each room has one stationary viewport-height background; glass panels and app content scroll normally over it. **Every piece of the decorative border must remain in frame**, on desktop and mobile. Use centered `background-size: contain`, `no-repeat`, and an obsidian canvas for any remaining space. Never crop with `cover`, enlarge beyond the viewport, stretch nonproportionally, or repeat the image down the page. On phones, landscape images will appear smaller so the edges remain visible.

## Exact eight images
| ID | Placement | Asset |
| --- | --- | --- |
| 1 | Mobile welcome / sign-in | `nhs-at2-mobile-welcome.webp` |
| 2 | Admin Observatory | `nhs-at2-command-center.webp` |
| 3 | Muse Creative Studio | `nhs-at2-muse-chamber.webp` |
| 4 | Project Pipeline | `nhs-at2-project-pipeline.webp` |
| 5 | Client Sanctuary | `nhs-at2-client-sanctuary.webp` |
| 6 | Branded welcome | `nhs-at2-brand-welcome.webp` |
| 7 | Admin entrance | `nhs-at2-admin-entrance.webp` |
| 8 | Leads / Forms workspace | `nhs-at2-workspace-floral.webp` |

There are exactly **eight** user-selected source JPEGs and eight optimized WebPs. The blue medical composition is not part of this package, manifest, preview, staging plan, or imported-app allowlist. No extra imagery is retained.

## Handoff archive
- Filename: `NHS_OS_Atelier_8_Full_Frame_2026-11-17.zip`
- SHA-256: `79f78243792e92748fb04b28d4e1eac4d33f4158679020eef508c9590d524c51`
- Entries: 8 WebPs in `app/`, 8 unchanged original JPEGs in `sources/`, `manifest.json`, `preview/index.html`, `README.md`. No other files.
- Source and WebP checksums pinned in `docs/design/nhs-at2-assets.json`; optional local importer verifies every original and derivative before writing.
- Preview is an offline synthetic interface, *not* the actual NHS app. Its backdrop stays fixed while the UI scrolls.

## Draft-only import
Check out branch `design/nhs-at2-background-handoff-20261117`, or select that branch in GitHub, and upload **only the exact ZIP** to `assets/handoff/` via **Add file → Upload files**. Workflow `.github/workflows/nhs-at2-import-draft.yml` verifies the ZIP, rejects extra files, installs eight image WebPs in `public/visuals/`, and removes the temporary archive from Git. It does not activate CSS, merge or deploy.

CLI dry-run alternative:
```bash
python3 scripts/import-nhs-at2-backgrounds.py /path/to/NHS_OS_Atelier_8_Full_Frame_2026-11-17.zip
python3 scripts/import-nhs-at2-backgrounds.py /path/to/NHS_OS_Atelier_8_Full_Frame_2026-11-17.zip --apply
```
`--apply` requires this exact draft branch, imports local binaries only, and does not commit or deploy.

## Acceptance gates
- [x] Exactly eight images; no unwanted extra composition anywhere in the pack.
- [x] All source JPEGs preserved byte-for-byte, WebPs verified by SHA-256.
- [x] Fixed room layers updated from `cover` to `contain` for Observatory, Muse, Client Sanctuary and shared room environments.
- [x] Browser test expectations updated to require a contained photograph in each room at desktop and phone sizes.
- [x] Eight exact new WebP binaries imported to GitHub draft and SHA-256 verified
- [ ] Real app desktop/tablet/phone screenshots reviewed for *complete* border, backdrop stability, legibility, accessibility and no horizontal overflow (activation is for review only)
- [ ] Exact-head CI green and owner approves artwork activation.
- [ ] Release review and deployment (NOT authorized).

Preserve existing NHS logo, app functionality, user permissions, client data, Supabase Storage, Auth/RLS, Muse AI settings and all outbound-service safety boundaries. **Do not activate a new photo URL before its verified binary is present.**

## Draft activation checkpoint · November 18, 2026

The GitHub one-ZIP workflow passed and committed all eight exact WebPs in `public/visuals/`. The staged role-specific mappings are now active **only on draft PR #80** through `app/living-atelier-artwork-active.css`, imported after the existing crystal-glass and local-font preview layers. The verified scenes are Observatory, Muse, Pipeline, Electric Lead Intelligence and the Client Sanctuary homepage. The sign-in screen uses the branded welcome image on desktop and the portrait artwork on mobile. The separate admin entrance alternate remains deliberately unactivated; the existing Rose and Archive rooms keep their distinct approved scenes. The original NHS logo is unchanged.

Asset-size and SHA-256 verification is included in `scripts/verify-nhs-at2-activation.mjs` and GitHub's `NHS OS verification` workflow. Playwright has a desktop/mobile test that checks scene uniqueness, one stationary viewport backdrop per room, `contain` image fitting, and no horizontal overflow. Exact-head CI, visual sign-off, real client-isolation acceptance, and any staging/production deployment remain independent gates.

**Do not re-upload the ZIP**: the importer has already moved the verified WebPs into the draft. Future image changes must be reviewed as separate changes, never automatically published.
