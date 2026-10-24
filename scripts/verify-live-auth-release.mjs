// Read-only preflight for a manually dispatched live browser QA run.
// This deliberately makes no credentialed requests, database mutations or form submissions.
// It rejects an older live login implementation before running the full browser suite.
import assert from "node:assert/strict";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error("Missing E2E_BASE_URL for live auth compatibility check.");

const origin = new URL(baseURL);
assert.equal(origin.protocol, "https:", "Live QA must target HTTPS.");
assert.equal(origin.hostname, "app.ninthheartstudios.com", "This preflight is restricted to the NHS OS production host.");

async function getPage(path) {
  const response = await fetch(new URL(path, origin), {
    method: "GET",
    headers: { Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Live ${path} returned HTTP ${response.status}. Production browser QA is blocked.`);
  }
  const html = await response.text();
  if (!/<main\b/i.test(html)) {
    throw new Error(`Live ${path} did not return a recognizable application page. Production browser QA is blocked.`);
  }
  return html;
}

const signIn = await getPage("/auth/sign-in");
if (!signIn.includes("Enter NHS OS")) {
  throw new Error("Live sign-in page does not match the expected NHS OS application. Check the deployed Worker and route.");
}
const passwordInput = signIn.match(/<input\b(?=[^>]*\bname\s*=\s*["']password["'])[^>]*>/i)?.[0];
if (!passwordInput) throw new Error("Live sign-in page has no password input; live browser QA is blocked.");
if (/\bminlength\s*=\s*["']?\d+/i.test(passwordInput)) {
  throw new Error(
    "LIVE RELEASE MISMATCH: production sign-in still enforces a browser password minimum. " +
    "Existing QA accounts may be blocked before authentication. The PR #22 fix is not live; " +
    "do not repeat authenticated browser tests until the separately approved update is deployed.",
  );
}

const recovery = await getPage("/auth/forgot-password");
if (!recovery.includes("Reset password")) {
  throw new Error("Live password-recovery page did not render expected content.");
}
console.log("Live read-only auth preflight: public sign-in and recovery pages render; no legacy sign-in minlength restriction found.");
console.log("This is not a login, email-delivery, authenticated navigation, or persistence test.");
