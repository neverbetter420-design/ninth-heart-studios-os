# NHS Soft Atelier browser QA repair

The actual reviewed design changed from all-dark content to a dark navigation shell with a warm ivory Command Center and light Project workspace. Previous Playwright tests mistakenly measured text against the now-dark app shell or transparent action panel rather than the actual ivory parent surface; their reported failures (contrast ratios 3.27 and 1.63) were invalid comparisons, not actual readable text against its real background.

Changes:
- Keep the WCAG 4.5:1 contrast threshold but measure metric subtitles and action names against the real .nhs-command-surface, not distant dark/transparent ancestors.
- Test floral SVG decode on intentionally decorative Admin and Client welcome headers. Verify floral art is absent from the busy working canvas. The old test incorrectly required a floral SVG as the whole application's background on every page.
- Confirm actual painted warm ivory backgrounds on Admin Command Center and Admin project, client project backdrop remains functional, preserved NHS original mark, and no 390px overflow.
- The offline artifact's mobile 390px selection now accepts a rendered width less than 390 to accommodate 16px horizontal padding, while explicitly verifying the preview stays within viewport.
- Preserve synthetic data, reduced motion/forced colors coverage, and production isolation. No CSS/accessibility thresholds are weakened, nor any app or client data changed.

Draft PR only, no merge or deploy until all checks pass and owner visually approves the appearance.
