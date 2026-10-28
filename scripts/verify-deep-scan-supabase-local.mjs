import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Real PostgREST/RLS lease tests against the existing disposable Supabase CI
// instance, never production. Imported ONLY by verify-phase3-supabase-local.mjs.
export async function verifyDeepScanLeaseLocal({ admin, clientA, clientB, anonymous, adminId }) {
  if (process.env.CI !== "true" ||
      !/^http:\/\/(localhost|127\.0\.0\.1):54321\/?$/.test(process.env.NHS_LOCAL_SUPABASE_URL ?? "") ||
      process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_DB_PASSWORD) {
    throw new Error("Deep Scan lease tests refuse hosted or non-CI Supabase credentials");
  }
  const rows = (result, name) => {
    assert.equal(result.error, null, name + ": " + (result.error?.message ?? ""));
    assert.ok(Array.isArray(result.data), name + " must return rows");
    return result.data;
  };
  const denied = async (result, name) => {
    if (!result.error) assert.equal((result.data ?? []).length, 0, name + " exposed unauthorized records");
  };
  const candidates = Array.from({ length: 8 }, (_, n) => ({
    source_ref: "node:" + (950000 + n), name: "Disposable CI Pub " + n,
    category: "pub", address: "100 Synthetic Way, Puyallup, WA",
    phone: "253-555-0188", website: null, lat: 47.1, lng: -122.3, social_profiles: [],
  }));
  const created = rows(await admin.from("deep_scan_jobs").insert({
    created_by: adminId, location: "Puyallup, WA", area_label: "Puyallup, Pierce County",
    radius_m: 16093, niches: ["bars"], requested: 12, candidates,
  }).select("id,status,position,created_by"), "admin Deep Scan fixture");
  assert.equal(created.length, 1);
  const id = created[0].id;
  assert.equal(created[0].status, "ready");
  assert.equal(created[0].created_by, adminId);

  await denied(await anonymous.from("deep_scan_jobs").select("id").eq("id", id), "Anonymous read RLS");
  await denied(await anonymous.rpc("claim_deep_scan_batch", { p_id: id }), "Anonymous RPC claim");
  await denied(await clientA.from("deep_scan_jobs").select("id").eq("id", id), "Client A RLS");
  await denied(await clientB.from("deep_scan_jobs").update({ status: "cancelled" })
    .eq("id", id).select("id"), "Client B update RLS");
  await denied(await clientA.from("deep_scan_jobs").insert({
    created_by: adminId, location: "CI Attempt", area_label: "CI",
    radius_m: 16093, niches: ["bars"], requested: 12, candidates,
  }).select("id"), "client job creation");

  // Two concurrent HTTP claims must serialize on ONE job row.
  const [claimOne, claimTwo] = await Promise.all([
    admin.rpc("claim_deep_scan_batch", { p_id: id }),
    admin.rpc("claim_deep_scan_batch", { p_id: id }),
  ]);
  const claims = [...rows(claimOne, "concurrent claim A"), ...rows(claimTwo, "concurrent claim B")];
  assert.equal(claims.length, 1, "only one of two simultaneous claims may take the lease");
  const token = claims[0].lease_token;
  assert.ok(typeof token === "string" && token.length > 20);
  assert.equal(claims[0].status, "running");
  await denied(await clientA.rpc("renew_deep_scan_batch", {
    p_id: id, p_lease: token,
  }), "Client A renew other user's lease");
  await denied(await clientB.rpc("finish_deep_scan_batch", {
    p_id: id, p_lease: token, p_processed: 6,
    p_created: 0, p_refreshed: 0, p_held: 6, p_conflicts: 0,
  }), "Client B finish other user's lease");
  assert.equal(rows(await admin.rpc("renew_deep_scan_batch", {
    p_id: id, p_lease: randomUUID(),
  }), "forged renew").length, 0);
  const active = rows(await admin.rpc("renew_deep_scan_batch", {
    p_id: id, p_lease: token,
  }), "legitimate renew");
  assert.equal(active.length, 1);
  assert.equal(active[0].lease_token, token);
  assert.ok(Date.parse(active[0].lease_until) > Date.now() + 20_000);

  const wrong = rows(await admin.rpc("finish_deep_scan_batch", {
    p_id: id, p_lease: randomUUID(), p_processed: 6,
    p_created: 0, p_refreshed: 0, p_held: 6, p_conflicts: 0,
  }), "forged completion");
  assert.equal(wrong.length, 0);
  const invalidCount = rows(await admin.rpc("finish_deep_scan_batch", {
    p_id: id, p_lease: token, p_processed: 7,
    p_created: 0, p_refreshed: 0, p_held: 7, p_conflicts: 0,
  }), "overlarge completion");
  assert.equal(invalidCount.length, 0);

  // A lease that expired cannot be revived. Only a fresh atomic claim can
  // process its position. The OLD token may not finish, pause, or renew it.
  rows(await admin.from("deep_scan_jobs").update({
    lease_until: "2001-01-01T00:00:00Z",
  }).eq("id", id).select("id"), "simulate expiry in disposable DB");
  assert.equal(rows(await admin.rpc("renew_deep_scan_batch", {
    p_id: id, p_lease: token,
  }), "expired token renew").length, 0);
  const reclaimed = rows(await admin.rpc("claim_deep_scan_batch", {
    p_id: id,
  }), "new claim after expiry");
  assert.equal(reclaimed.length, 1);
  const newToken = reclaimed[0].lease_token;
  assert.notEqual(newToken, token);
  assert.equal(rows(await admin.rpc("pause_deep_scan_batch", {
    p_id: id, p_lease: token, p_error: "stale worker",
  }), "old worker pause").length, 0);
  assert.equal(rows(await admin.rpc("finish_deep_scan_batch", {
    p_id: id, p_lease: token, p_processed: 6,
    p_created: 0, p_refreshed: 0, p_held: 6, p_conflicts: 0,
  }), "old worker finish").length, 0);
  const committed = rows(await admin.rpc("finish_deep_scan_batch", {
    p_id: id, p_lease: newToken, p_processed: 6,
    p_created: 0, p_refreshed: 0, p_held: 6, p_conflicts: 0,
  }), "reclaimed worker finish");
  assert.equal(committed.length, 1);
  assert.equal(committed[0].position, 6);
  assert.equal(committed[0].status, "ready");
  const finalClaim = rows(await admin.rpc("claim_deep_scan_batch", { p_id: id }), "last claim");
  assert.equal(finalClaim.length, 1);
  const final = rows(await admin.rpc("finish_deep_scan_batch", {
    p_id: id, p_lease: finalClaim[0].lease_token, p_processed: 2,
    p_created: 0, p_refreshed: 0, p_held: 2, p_conflicts: 0,
  }), "final finish");
  assert.equal(final.length, 1);
  assert.equal(final[0].position, 8);
  assert.equal(final[0].status, "completed");
  assert.equal(rows(await admin.rpc("claim_deep_scan_batch", { p_id: id }),
    "cannot reclaim complete job").length, 0);
  console.log("PASS Deep Scan: disposable RLS, concurrent claim, expired/stale lease renewal, and final progress");
}
