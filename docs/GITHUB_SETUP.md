# GitHub Handoff

The project is already a local Git repository on the `main` branch with an initial commit.

## Repository to create

Create a **private** GitHub repository named:

`ninth-heart-studios-os`

Do not initialize it with a README, `.gitignore`, or license because those already exist in this project.

## Connect this project to GitHub

From the VS Code terminal in the project folder:

```bash
git remote add origin https://github.com/neverbetter420-design/ninth-heart-studios-os.git
git push -u origin main
```

If GitHub asks you to authenticate, complete the normal browser/device authentication flow.

## After the first push

Phase 2 is now implemented in the codebase. After the first push, connect a dedicated Supabase project and follow `docs/PHASE_2_SETUP.md` before importing any production data.
