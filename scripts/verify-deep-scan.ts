// Pure Deep Scan QA (does not connect to live Supabase or external websites).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEEP_SCAN_SIZES, DEEP_SCAN_BATCH_SIZE, validDeepSize,
  nextDeepScanBatch, deepScanPercent, expiredDeepLease } from "../lib/deep-scan.ts";
import { prioritizeDiscovered } from "../lib/prospect-curation.ts";
import type { DiscoveredBusiness } from "../lib/prospect-scan.ts";

assert.deepEqual(DEEP_SCAN_SIZES, [12,25,50,100]);
for (const n of DEEP_SCAN_SIZES) assert.ok(validDeepSize(n));
for (const n of [0,1,6,11,26,49,99,101,-1,NaN,Infinity,"50",null])
  assert.equal(validDeepSize(n),false);
assert.equal(DEEP_SCAN_BATCH_SIZE, 6);

const sample = (i: number): DiscoveredBusiness => ({
  source_ref: "node:"+(i+1000), name: "Business "+i,
  category: i%3===0?"restaurant":i%3===1?"pub":"hairdresser",
  address:"Puyallup, WA", phone:"253-555-0100", website:null,
  lat:47.1,lng:-122.3,social_profiles:[],
});
const all = Array.from({length:100},(_,i)=>sample(i));
const pending = prioritizeDiscovered(all,["restaurants","bars","salons"],100);
assert.equal(pending.length,100,"large discovery must not be silently capped at 12 or 30");
assert.equal(new Set(pending.map(p=>p.source_ref)).size,100);
assert.deepEqual(pending.slice(0,3).map(p=>p.category),["restaurant","pub","hairdresser"],
  "interleaved niches do not starve salons or bars");
let index=0, steps=0;
while(index<pending.length) {
  const batch=nextDeepScanBatch(pending,index);
  assert.ok(batch.length>0 && batch.length<=6);
  index+=batch.length;
  steps++;
}
assert.equal(index,100);
assert.equal(steps,17,"100 business analyses require 17 bounded user-invoked batches");
assert.deepEqual(nextDeepScanBatch(pending,96).map(p=>p.name),
  pending.slice(96).map(p=>p.name));
assert.deepEqual(nextDeepScanBatch(pending,100),[]);
for(const bad of [-1,101,1.5,NaN]) assert.throws(()=>nextDeepScanBatch(pending,bad));
assert.equal(deepScanPercent(6,25),24);
assert.equal(deepScanPercent(12,25),48);
assert.equal(deepScanPercent(30,25),100);
assert.equal(deepScanPercent(0,0),0);
assert.equal(expiredDeepLease("running","2026-10-28T00:00:00Z",Date.parse("2026-10-28T00:02:00Z")),true);
assert.equal(expiredDeepLease("running","2026-10-28T00:05:00Z",Date.parse("2026-10-28T00:02:00Z")),false);
assert.equal(expiredDeepLease("ready","2026-10-28T00:00:00Z",Date.parse("2026-10-28T00:02:00Z")),false);

// Static security guard rails for the new migration. Runtime RLS must also
// pass the authenticated local Supabase test gate before release.
const sql=readFileSync("supabase/migrations/20261028090000_deep_scan_jobs.sql","utf8");
for(const pattern of [
  /alter table public\.deep_scan_jobs enable row level security;/,
  /revoke all on public\.deep_scan_jobs from anon;/,
  /private\.is_admin\(\)/,
  /created_by = \(select auth\.uid\(\)\)/,
  /lease_token = p_lease/,
  /p_processed between 1 and 6/,
  /j\.lease_until > now\(\)/,
]) assert.match(sql,pattern);
assert.doesNotMatch(sql, /security definer/i, "lease RPC must respect caller RLS");
assert.doesNotMatch(sql, /pg_cron|cron\.schedule/i, "no unattended polling");
console.log("verify:deep-scan — all checks passed.");
