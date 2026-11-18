# Draft artwork ZIP upload

On the **existing** branch `design/nhs-at2-background-handoff-20261117`, upload the exact file `NHS_OS_Atelier_8_Full_Frame_2026-11-17.zip` here using **Add file → Upload files**.

The draft-only GitHub Actions workflow will verify ZIP SHA-256 `79f78243792e92748fb04b28d4e1eac4d33f4158679020eef508c9590d524c51`, all eight source originals, all eight optimized WebPs, and the exact list of ZIP members. It rejects additional images.

If successful, it commits only eight verified `public/visuals/nhs-at2-*.webp` files and removes the temporary ZIP on the same draft branch. It does **not** activate artwork, merge, publish, deploy or touch backend data.

Every artwork is **fully contained, never cropped**; the background remains stationary while glass content scrolls over it. The manual dry-run and design review are documented in `docs/design/nhs-at2-image-handoff.md`.
