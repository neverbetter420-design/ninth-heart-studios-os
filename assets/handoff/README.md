# NHS OS · Draft artwork handoff

This folder is the **temporary drop-off** for the single approved ZIP:

`NHS_OS_Atelier_Backgrounds_FIXED_2026-11-17.zip`

**Use only the GitHub branch** `design/nhs-at2-background-handoff-20261117`.

Upload that exact ZIP into this folder via GitHub **Add file → Upload files**. The
branch-only, path-scoped workflow `nhs-at2-import-draft.yml` will validate the
archive SHA-256, all expected members, each app WebP SHA-256 and the excluded
healthcare file. If validation succeeds, the workflow installs precisely eight
WebP files into `public/visuals/`, then deletes the temporary ZIP from Git.

This does **not** import a stylesheet, change a running website, merge PR #80,
deploy to Cloudflare, modify Supabase, or activate paid features.

After the import completes, review the actual images and source-only render
before enabling the staged mapping at
`docs/design/nhs-at2-staged-room-map.css`. Import is not visual approval.

The ZIP itself should never remain in the final source history except the
initial temporary upload commit. Its original JPEG sources and the reserved
healthcare image are deliberately not copied to the app.

If automation is unavailable, use the manual import commands in
`docs/design/nhs-at2-image-handoff.md`. Never substitute lookalike images.
