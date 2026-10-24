# Seven Rooms: QA remediation after owner design approval

Owner approved the Seven Rooms visual direction. Five of seven CI suites passed on the previous commit. The browser suite and isolated local Supabase mobile UI suite reported failures.

Browser regression fixes:
- Artist Atelier pipeline and Private Archive documents overflowed 43px at desktop because full-width content had additional outer margins. CSS width:auto constrains these rooms to available space without changing the mobile layout.
- Lead scanner legitimately uses a new 17px rounded control panel. The legacy zero-radius visual assertion was updated to the intentional Electric Conservatory design.
- Increased contrast and forced-colors media query disables welcome artwork despite the room-specific, higher-specificity background rule.

Local mobile form test:
- The Required field checkbox previously timed out when a wrapped label and sticky mobile navigation intercepted an input-targeted Playwright click. The test clicks the accessible label and separately requires a checked input. The checkbox and label also get sufficient size and sticky-header scroll margins.

No real user data, permissions, authentication, scanner logic, migrations, or production resources were changed. Keep draft PR #21 unmerged until exact-head CI and owner release approval requirements are satisfied.
