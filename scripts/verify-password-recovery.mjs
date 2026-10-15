import assert from "node:assert/strict";
import { isPasswordRecoveryReturn, passwordRecoveryRedirectUrl } from "../lib/password-recovery.ts";

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
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password?code=sample")), true);
assert.equal(
  isPasswordRecoveryReturn(url("/auth/reset-password#access_token=sample&type=recovery")),
  true,
);
assert.equal(isPasswordRecoveryReturn(url("/auth/reset-password?recovery=1&error=invalid")), false);
assert.equal(
  isPasswordRecoveryReturn(url("/auth/reset-password#type=recovery&error=access_denied")),
  false,
);
console.log("Password recovery URL checks passed.");
