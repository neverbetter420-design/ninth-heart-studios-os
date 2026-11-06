import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", testMatch: "open-plan.spec.mjs", timeout: 180000,
  fullyParallel: true,
  workers: 1, reporter: [["list"], ["html", { outputFolder: "open-plan-report", open: "never" }]],
  use: { browserName: "chromium", screenshot: "only-on-failure", trace: "retain-on-failure" },
});
