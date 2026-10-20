import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";

// Source-rendered, synthetic fixtures deny all network traffic. They do not need
// a Next server, Supabase URL, login credentials or a hosted preview deployment.
export default defineConfig({
  ...base,
  testMatch: "nocturne-visual.spec.mjs",
  webServer: undefined,
});
