# NHS OS | Living Atelier original-asset handoff

**Status:** Exact uploads verified and optimized. **Binary assets are not yet committed to the repository.** This is a source-only review, not a claim that the new atmosphere is already visible in deployed NHS OS.

## Approved source mapping

| Asset / room | Actual user-uploaded PNG file | Target repository path | Source SHA-256 | WebP SHA-256 |
| --- | --- | --- | --- | --- |
| Image 01 · Velvet Observatory | `ChatGPT Image Nov 14, 2026, 04_08_03 PM-2.png` | `public/visuals/nhs-living-atelier-observatory.webp` | `06a174495ef6b9de6724fd32ecf8bc460416e96af7b96bd3324f7b1c5451689a` | `e5130cae5a1a8d30e6b2c0a09cd59d6350a36f278240f5f55480fc850a0c0284` |
| Image 05 · Client Sanctuary | `Midnight Chrome Rose in Blue and Magenta(1).png` | `public/visuals/nhs-living-atelier-client-sanctuary.webp` | `7e648c21a2d0bd9ca423b37943a86f12f11ac77d0c31432522b52534168a02a9` | `b0b259d26af5ac7d8ff07dbdc1c65fb5b517ad6856b8f9ec74ff1d10182ed9d6` |

Both originals are **1672×941 PNGs**. The supplied WebP delivery copies were exported from the exact originals (WebP quality 90) without altering their composition, drawing, text, or scene:
- Observatory: **138,064 bytes**.
- Client Sanctuary: **151,750 bytes**.

The original PNGs were not modified or replaced. The WebP copies are compressed delivery derivatives, **not** lossless copies. Preserve originals outside the deployment bundle for future re-optimization.

## Verified ZIP and fail-closed import

The previously prepared archive `NHS_Living_Atelier_Approved_Backgrounds.zip`
has SHA-256 `23f7482faf09c015a140a53ed6335d1fafb029a9919d00505262557545758e0f`.
The downloaded package must match exactly before import. Its individual
WebP files and `manifest.json` also have pinned checksums.

The repo now includes the standard-library-only Python helper
`scripts/import-living-atelier-assets.py` with an explicit dry-run default:

```bash
python3 scripts/import-living-atelier-assets.py /path/to/NHS_Living_Atelier_Approved_Backgrounds.zip
python3 scripts/import-living-atelier-assets.py /path/to/NHS_Living_Atelier_Approved_Backgrounds.zip --apply
```

This executes **locally in a checked-out copy of the draft design branch**.
The script verifies the exact archive hash, three expected filenames,
manifest and WebP hashes, avoids path traversal/symlinks, and refuses to
overwrite images whose bytes differ. Its `--self-test` runs in source-only
GitHub CI without needing access to the uploaded image ZIP.

After running with `--apply`, the exact files appear under
`public/visuals` in that working copy. They **do not automatically
upload to GitHub**. Review the file changes and commit them to
`design/living-atelier-observatory-pulse-20261114` only, never production.

If using GitHub's web editor instead, unzip locally and upload the two
WebP files through **Add file → Upload files** in `public/visuals` on
this same draft branch. Do not upload the ZIP as if Next.js could serve
the images inside it. The draft's SHA-256 CI gate rejects altered binaries.

**Until the files are actually committed**, the approved-artwork CSS
variable remains unset and the current Observatory artwork stays active.
Adding both files alone does not authorize Client Sanctuary visual changes.

## Integration controls

1. Review the actual WebP assets visually. Upload the two reviewed binary files to the exact repository paths above on this **draft** design branch, through a separately supported file-upload workflow. Do **not** use a generated substitute, stock asset, or a URL to an unapproved external site.
2. The Observatory's `app/nocturne-dark-rose-cinematic.css` now supports an optional `--nhs-observatory-approved-artwork` URL custom property for its three desktop/mobile background layers. It is intentionally **unset** until the exact WebP binary is in the repository. Existing `/visuals/nhs-dark-rose-photographic.webp` remains the fallback.
3. After the Observatory WebP is committed and hash-verified, set `--nhs-observatory-approved-artwork: url("/visuals/nhs-living-atelier-observatory.webp")` **only** in the scoped Admin Observatory selector. Then validate desktop/mobile crops and readability against the approved concept. Avoid copying a double-darkened overlay, raising opacities without review, or replacing other rooms.
4. Client Sanctuary artwork is **prepared but unintegrated**. It requires a separate client-specific composition and isolation review before setting any client Portal background.
5. Verify image load, no broken assets, original NHS logo, keyboard navigation, 44px touch controls, read-only data states, reduced motion, and Chromium accessibility tests after each asset integration.

## Safety boundary

The public-only staging permission freeze, Storage policy blocker, dormant Muse features, and release review remain independent. No merge, staging/production deploy, Supabase policy/ACL mutation, paid integration, outbound scan or outreach is authorized by this design-asset handoff.

The source SHA values identify the approved user-uploaded artwork; the WebP SHA values identify the prepared delivery bytes so future substitutions can be detected.
