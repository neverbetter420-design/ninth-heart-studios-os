# GitHub Handoff

The private GitHub repository is live at:

`neverbetter420-design/ninth-heart-studios-os`

The `main` branch contains the Phase 1 foundation plus the Phase 2 Supabase/authentication/security upgrade.

## Clone into VS Code

```bash
git clone https://github.com/neverbetter420-design/ninth-heart-studios-os.git
cd ninth-heart-studios-os
code "Ninth Heart Studios OS.code-workspace"
```

If GitHub asks you to authenticate, complete the normal browser/device authentication flow.

## Existing local copy

If you already have the Phase 1 local folder, connect it to the GitHub repository before doing more development:

```bash
git remote add origin https://github.com/neverbetter420-design/ninth-heart-studios-os.git
git fetch origin
git switch main
```

Because Phase 2 is already committed remotely, cloning the repository fresh is the cleanest handoff.

## Next infrastructure step

Connect a dedicated Supabase project and follow `docs/PHASE_2_SETUP.md` before importing any production data.
