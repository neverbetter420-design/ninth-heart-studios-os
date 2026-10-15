import assert from "node:assert/strict";
import { isPasswordRecoveryReturn, passwordRecoveryRedirectUrl, passwordResetErrorMessage } from "../lib/password-recovery.ts";

const url = (path) => new URL(path, "https://app.ninthheartstudios.com");

assert.equal(
  passwordRecoveryRedirectUrl("https://app.ninthheartstudios.com/whatever"),
  "https://app.ninthheartstudios.com/auth/reset-password?recovery=1",
);
assert.equal(
  passwordRecoveryRedirectUrl("http://localhost:3000"),
  "http://localhost:3000/auth/reset-password?recovery=1",
);
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password")), false);
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password?recovery=1")), true);
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password?code=sample")), false);
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password?recovery=1&code=sample")), true);
assert.equal(
  isPasswordRecoveryReturn(url("/auth/reset-password#access_token=sample&type=recovery")),
  true,
);
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password?recovery=1&error=invalid")), false);
assert.equal(
  isPasswordRecoveryReturn(url("/auth/reset-password#type=recovery&error=access_denied")),
  false,
);
// The same errors must be shown regardless of whether an email exists.
assert.match(passwordResetErrorMessage({ status: 429 }), /wait before requesting/i);
assert.match(passwordResetErrorMessage({ code: "over_email_send_rate_limit" }), /wait before requesting/i);
assert.equal(
  passwordResetErrorMessage({ status: 503, code: "smtp_failure" }),
  passwordResetErrorMessage(),
);
assert.doesNotMatch(passwordResetErrorMessage(), /registered|unknown email/i);

console.log("Password recovery URL and failure-handling checks passed.");
