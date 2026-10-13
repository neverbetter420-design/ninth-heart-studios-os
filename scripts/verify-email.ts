// Phase 8 verification: email lib checks. No network — config and validation only.
import assert from "node:assert/strict";
import { getEmailConfig, isEmailConfigured } from "../lib/email.ts";

// 1. Missing env → not configured (never throws on import)
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;
assert.equal(isEmailConfigured(), false, "No env means email is not configured");
assert.equal(getEmailConfig(), null, "getEmailConfig returns null without env");

// 2. Partial env → still not configured
process.env.GMAIL_USER = "hailey@ninthheartstudios.com";
assert.equal(isEmailConfigured(), false, "User without app password is not configured");

// 3. Full env → configured, whitespace tolerated
process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
const config = getEmailConfig();
assert.ok(config, "Full env must produce a config");
assert.equal(config?.user, "hailey@ninthheartstudios.com");
assert.equal(config?.appPassword, "abcdefghijklmnop", "App password spaces are stripped");

delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;

console.log("verify:email — all checks passed.");
