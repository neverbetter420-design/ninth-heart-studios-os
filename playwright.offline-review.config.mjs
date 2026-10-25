import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

// Browser the HTML preview from file:// only. No dev server, credentials,
// production domain, or Supabase connection. Tests block all external requests.
export default defineConfig({
  ...base,
  testMatch: "nocturne-offline-preview.spec.mjs",
  webServer: undefined,
});
