/**
 * Non-destructive smoke test for the COMPILED Cloudflare Worker, not next dev.
 *
 * The Oct 24 release built successfully but returned HTTP 500 on every live route.
 * Run inside a CI runner only, over loopback. Does not submit forms, authenticate,
 * connect to a browser profile, or deploy anything. The command uses wrangler's
 * local workerd runtime with the repository's production Worker configuration.
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const workerPath = ".open-next/worker.js";
assert.ok(existsSync(workerPath), "Build with npm run cf:build before this runtime smoke.");
const port = 8787;
const origin = `http://127.0.0.1:${port}`;
const commands = process.platform === "win32" ? "npx.cmd" : "npx";
const args = ["--no-install", "wrangler", "dev", "--local", "--ip", "127.0.0.1", "--port", String(port), "--config", "wrangler.jsonc"];
const child = spawn(commands, args, {
  cwd: process.cwd(),
  env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
let childExited = null;
const record = (chunk) => { output = (output + String(chunk)).slice(-16000); };
child.stdout.on("data", record);
child.stderr.on("data", record);
child.on("exit", (code, signal) => { childExited = { code, signal }; });
child.on("error", (error) => { childExited = { error: error.message }; });

const deadline = Date.now() + 80000;
async function get(path, timeout = 5000) {
  return fetch(origin + path, { redirect: "manual", signal: AbortSignal.timeout(timeout) });
}
async function ready() {
  let last = "";
  while (Date.now() < deadline) {
    if (childExited) throw new Error("The local Worker process stopped: " + JSON.stringify(childExited));
    try {
      const response = await get("/auth/sign-in");
      // A 500 is a decisive Worker runtime failure, not a readiness condition.
      if (response.status >= 500) {
        throw new Error(`Compiled Worker returned HTTP ${response.status} on /auth/sign-in`);
      }
      return response;
    } catch (error) {
      if (/Compiled Worker returned|local Worker process stopped/.test(String(error.message))) throw error;
      last = error.message;
      await delay(900);
    }
  }
  throw new Error("Local Worker did not become ready within 80 seconds: " + last);
}
async function checkPublic(path, expected, initialResponse) {
  const response = initialResponse || await get(path);
  assert.equal(response.status, 200, `Compiled Worker ${path} returned HTTP ${response.status}, not 200`);
  const html = await response.text();
  assert.match(html, /<main\b/i, `Compiled Worker ${path} has no main content`);
  assert.ok(html.includes(expected), `Compiled Worker ${path} is missing expected content`);
  console.log(`PASS compiled Cloudflare Worker GET ${path} -> HTTP 200 and expected HTML`);
}
try {
  const first = await ready();
  await checkPublic("/auth/sign-in", "Enter NHS OS", first);
  await checkPublic("/auth/forgot-password", "Reset password");
  // Source of truth for the visual design; this run must not change its styles.
  assert.ok(existsSync("app/seven-rooms.css"), "Approved Seven Rooms stylesheet is missing");
  assert.ok(existsSync("lib/studio-rooms.ts"), "Approved Seven Rooms route map is missing");
  console.log("PASS the compiled Worker boots locally with the approved Seven Rooms source present");
  console.log("No production requests, credentials, logins, writes or Worker deployments were executed.");
} catch (error) {
  console.error("FAIL compiled Worker runtime smoke:", error.message);
  // Limit output to reduce incidental exposure of environment/stack data.
  const tail = output.split("\n").filter((line) => /error|fail|exception|ready|listening|internal|next\/|open.next|wrangler/i.test(line)).slice(-16);
  if (tail.length) console.error("Local Worker diagnostic lines:\n" + tail.join("\n").slice(-3500));
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
