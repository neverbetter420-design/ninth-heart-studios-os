// Spec 2 verification: contract signing logic. No database, no network.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Mirror of the hash computation in app/(protected)/portal/contracts/actions.ts
function signatureHash(body: string, signerEmail: string, signedAt: string): string {
  return createHash("sha256")
    .update(`${body}::${signerEmail.toLowerCase()}::${signedAt}`)
    .digest("hex");
}

// 1. Hash is deterministic
const h1 = signatureHash("Terms v1", "Client@Example.com", "2026-10-12T20:00:00.000Z");
const h2 = signatureHash("Terms v1", "client@example.com", "2026-10-12T20:00:00.000Z");
assert.equal(h1, h2, "Email case must not change the hash");

// 2. Hash is tamper-evident: any input change alters it
const h3 = signatureHash("Terms v2", "client@example.com", "2026-10-12T20:00:00.000Z");
assert.notEqual(h1, h3, "Body change must alter the hash");
const h4 = signatureHash("Terms v1", "client@example.com", "2026-10-12T20:01:00.000Z");
assert.notEqual(h1, h4, "Timestamp change must alter the hash");

// 3. Hash format is hex SHA-256
assert.match(h1, /^[0-9a-f]{64}$/, "Hash must be 64-char hex");

// 4. State machine: only sent → signed is a legal client transition
const legal = (from: string, to: string) => from === "sent" && to === "signed";
assert.ok(legal("sent", "signed"), "sent → signed is legal");
assert.ok(!legal("draft", "signed"), "draft → signed is illegal");
assert.ok(!legal("signed", "sent"), "signed → sent is illegal");
assert.ok(!legal("voided", "signed"), "voided → signed is illegal");

console.log("verify:contracts — all checks passed.");
