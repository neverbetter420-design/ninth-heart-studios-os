# NHS OS | Website-to-app artwork handoff · November 17, 2026

**Status: REVIEW PREPARATION ONLY. No image binary committed, no CSS activated, no deployment.**

This document captures the nine current-chat JPEG uploads, their original byte checksums and optimized WebP derivatives in the downloadable archive `NHS_OS_Atelier_Backgrounds_2026-11-17.zip`. The complete derivative SHA-256 and byte-size allowlist is in [nhs-at2-assets.json](./nhs-at2-assets.json).

## New design candidates

| Original upload order | Room candidate | Optimized app filename | Review notes |
| --- | --- | --- | --- |
| 1 | Mobile sign-in | `nhs-at2-mobile-welcome.webp` | Portrait-only; preserve moon/key and dark login center |
| 2 | Admin Command Center | `nhs-at2-command-center.webp` | Skull/key on left, open right workspace; test 320px crop |
| 3 | Muse Creative Studio | `nhs-at2-muse-chamber.webp` | Dramatic upper/right sculpture; open left text area |
| 4 | Project Pipeline | `nhs-at2-project-pipeline.webp` | Restrained center suited to timelines and action rails |
| 5 | Client Sanctuary alternate | `nhs-at2-client-sanctuary.webp` | Rose left; **do not silently replace the previously approved blue-rose client image** |
| 6 | Branded welcome/transition | `nhs-at2-brand-welcome.webp` | Contains illustrative NHS lettering, not the official logo |
| 7 | Admin entrance alternate | `nhs-at2-admin-entrance.webp` | Contains illustrative NHS lettering, not the official logo |
| 8 | Everyday workspace (Leads/Forms/Contracts) | `nhs-at2-workspace-floral.webp` | Dark open center; use on one distinct room, not every route |
| 9 | Reserve only | `nhs-at2-healthcare-reserve.webp` | Contains medical/healthcare iconography and DNA; **do not ship with NHS OS** |

These are candidate assignments, not authorization to replace older art. All seven landscape candidates are 1536×864 and the portrait image is 732×1536. The WebP derivatives preserve dimensions and composition and use quality 90 (lossy). All original JPEGs are included unchanged in the ZIP's `sources/` directory.

## Exact reviewed package

- ZIP filename: `NHS_OS_Atelier_Backgrounds_2026-11-17.zip`
- ZIP SHA-256: `a995f44e317837dc0b1aeff76d740f4210c7cf19d94878273b6a197942d36204`
- Contains: `app/` (8 opt-in WebP candidates), `reserve/` (healthcare), `sources/` (all 9 JPEG originals), `manifest.json`, `preview/index.html`, and `README.md`
- `preview/index.html` runs fully offline with synthetic data. It illustrates dark scrims and glass, not the real app; no customer/API data is involved.
- Treat the pack as a handoff artifact, not an installed app resource.

## Import procedure after review

Only within branch `design/nhs-at2-background-handoff-20261117`:

```bash
python3 scripts/import-nhs-at2-backgrounds.py /path/to/NHS_OS_Atelier_Backgrounds_2026-11-17.zip
python3 scripts/import-nhs-at2-backgrounds.py /path/to/NHS_OS_Atelier_Backgrounds_2026-11-17.zip --apply
```

Dry-run checks the exact archive and all 8 images without writing. The second command is **optional and not yet run**; it copies the eight verified WebPs into `public/visuals/` in the locally checked-out draft branch. It does not commit, create a PR, activate CSS, merge or deploy. GitHub's text-file write connector cannot transfer this session's binary image bytes into the repository; use the supported local import + Git commit workflow or the GitHub **Upload files** UI, on this exact draft branch only. Review the eight files and checksums before any commit. Never upload the reserved healthcare file to the app.

## Implementation contracts after upload (separate approval)

1. Keep the actual original NHS logo asset unchanged. Embedded branded lettering in images 6/7 is decorative and may be visually cropped on mobile.
2. Integrate one room at a time, never with a global background override. The approved Observatory/Client Sanctuary/Muse source-only pilots and their current fallbacks must remain untouched until explicit visual approval to change a named room.
3. Use document-scrolling decorative composition rather than a viewport-fixed image. Do not stretch photo width and height independently. Constrain image dimensions with `background-size: cover` for hero art or `auto` for wallpaper plus calculated responsive positioning, reviewed at 1440, 1024, 740, 390 and 320px.
4. Preserve readable data in smoked-glass scrims, route/role isolation, non-text-overlap, original navigation and all manual action confirmations. No repeated images across room identities.
5. Run exact-head source/TypeScript/build, Playwright desktop/mobile, local authorization suites, privacy checks and screenshot approval. Current stacked branch lineage is PR #79 → #78 → #77; this new change should remain its own draft.
6. No staging or production deploy, Cloudflare config change, Supabase/Auth/Storage/ACL mutation, AI enablement, paid scan/outreach or auto-send. Staging Storage issue #71 remains independent.

## Current completion states

- [x] Source files inspected and dimensions verified
- [x] Eight WebP derivatives generated without resizing; original JPEGs archived
- [x] Each package entry SHA-256 pinned
- [x] Local importer dry-run passed against exact ZIP
- [x] Offline sample preview packaged
- [x] Source-only draft branch with importer + manifest
- [ ] Import binaries into GitHub draft branch
- [ ] Integrate scoped visual CSS and capture review images
- [ ] Obtain actual owner desktop/mobile visual acceptance
- [ ] Merge / publish (not authorized)
