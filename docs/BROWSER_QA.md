# Browser QA via GitHub Actions (Playwright)

Run the **NHS OS browser QA** GitHub Actions workflow. It runs the real Chromium browser in GitHub-hosted Linux, without TinyFish.

- Every pull request gets unauthenticated sign-in and access-protection smoke tests on the **development branch**, running locally inside the GitHub runner. All tests are read-only.
- To also test actual Admin, Client A and Client B navigation, add these **GitHub Actions repository secrets** under Settings → Secrets and variables → Actions:
  `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_CLIENT_A_EMAIL`, `E2E_CLIENT_A_PASSWORD`, `E2E_CLIENT_B_EMAIL`, `E2E_CLIENT_B_PASSWORD`.
- Use **dedicated test users only**, not a real client or admin's primary account. No service-role key is needed. Use accounts already linked to separate test clients/projects.
- Pull-request runs automatically test the proposed code in a local Next.js server on GitHub. **GitHub only exposes the manual Run workflow control after this workflow file also exists on the repository default branch**; it is not available yet on this draft PR. Once published to main, select the desired branch and **target=local** to test its code with test-account secrets, or **target=live** to smoke-test the currently deployed Cloudflare app. Live runs test the production version and **do not** test the unmerged PR navigation changes.
- The test creates no database records and never submits a business action. It only signs in, reads views, opens links, and checks route isolation.
- Download the `nhs-playwright-report` artifact for failure screenshots, traces, and videos.

Unauthenticated checks always run. If GitHub Actions secrets are not yet configured, authenticated browser tests explicitly appear as **skipped**, not passed.

Do not deploy or merge solely on the basis of a green browser workflow: review mobile screenshots, user experience, and the remaining form workflows first.
