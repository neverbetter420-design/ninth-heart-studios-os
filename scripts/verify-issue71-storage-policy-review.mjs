import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const security = new URL("../docs/security/", import.meta.url);
const proposals = {
 apply: readFileSync(new URL("issue71-stage-storage-policy-proposal.sql", security),"utf8"),
 undo: readFileSync(new URL("issue71-stage-storage-policy-rollback.sql", security),"utf8"),
 review: readFileSync(new URL("issue71-stage-storage-policy-review.md", security),"utf8"),
 defaults: readFileSync(new URL("issue71-stage-future-defaults-review.md", security),"utf8"),
};
const diagnostic = readFileSync(
 new URL("./sql/issue71-staging-storage-policy-readiness.sql",import.meta.url),"utf8"
);
const workflow = readFileSync(
 new URL("../.github/workflows/nhs-issue71-staging-review.yml",import.meta.url),"utf8"
);
for(const [name,content] of Object.entries({...proposals,diagnostic})){
 assert.ok(content.includes("qihwmfwlhsetxwggaesd"),name+" must name the exact stage");
 assert.ok(content.includes("rquscwgdrqkzwjukiqtk"),name+" must warn against production");
}
for(const document of [proposals.review,proposals.defaults]){
 assert.match(document,/(?:NOT APPLIED|NO-GO)/i);
 assert.match(document,/separate/i);
}
assert.match(proposals.apply,/NOT APPLIED/);
assert.match(proposals.undo,/NOT APPLIED/);
assert.ok(!workflow.includes("supabase migration up"),"CI must never run stage DDL");

const expected = [
 ["nhs_review_deny_storage_insert","INSERT","WITH CHECK (false)"],
 ["nhs_review_deny_storage_update","UPDATE","USING (false) WITH CHECK (false)"],
 ["nhs_review_deny_storage_delete","DELETE","USING (false)"]
];
const createPolicies=[...proposals.apply.matchAll(/CREATE POLICY "([^"]+)"\s+ON storage\.objects AS RESTRICTIVE FOR (INSERT|UPDATE|DELETE) TO anon, authenticated\s+([\s\S]*?);/g)];
const drops=[...proposals.undo.matchAll(/DROP POLICY "([^"]+)" ON storage\.objects;/g)];
assert.equal(createPolicies.length,3,"Exact three restrictive write policies only");
assert.equal(drops.length,3,"Only corresponding three rollback drops");
for(let i=0;i<3;i++){
 const [name,op,predicate]=expected[i];
 assert.equal(createPolicies[i][1],name);
 assert.equal(createPolicies[i][2],op);
 assert.equal(createPolicies[i][3].replace(/\s+/g," ").trim(),predicate);
 assert.equal(drops[i][1],name);
}
for(const file of [proposals.apply,proposals.undo]){
 assert.equal((file.match(/^BEGIN;$/gm)??[]).length,1);
 assert.equal((file.match(/^COMMIT;$/gm)??[]).length,1);
 assert.match(file,/73b4be5cc357949344792320ffff5dc1/);
 // Check executable SQL, not comments or quoted privilege names such as
 // 'DELETE, TRUNCATE, ...' inside has_table_privilege catalog queries.
 const executable=file.replace(/\/\*[\s\S]*?\*\//g," ")
   .replace(/--[^\n]*/g," ")
   .replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(executable,/\b(?:ALTER DEFAULT PRIVILEGES|REVOKE|GRANT|TRUNCATE|ALTER TABLE|UPDATE storage|INSERT INTO storage|DELETE FROM storage|CASCADE)\b/i);
 assert.doesNotMatch(executable,/\b(?:FOR SELECT|FOR ALL)\b/i);
 assert.doesNotMatch(executable,/\bIF EXISTS\b/i);
}
// Storage policies are table-owner DDL. Current staging connector is
// postgres (not superuser, not the storage table owner). Both apply and
// rollback must fail closed BEFORE any CREATE/DROP POLICY attempt.
for(const file of [proposals.apply,proposals.undo]){
 assert.ok(file.includes("SELECT current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)"),
   "Must check actual SQL executor and superuser status");
 assert.ok(file.includes("v_executor=v_owner OR COALESCE(v_executor_superuser,false)"),
   "Must reject non-owner/non-superuser policy executors");
 assert.ok(file.includes("v_owner IS DISTINCT FROM 'supabase_storage_admin'"),
   "Must confirm exact Storage owner");
 assert.ok(file.indexOf("v_executor=v_owner OR COALESCE(v_executor_superuser,false)")<
   file.indexOf(file===proposals.apply ? 'CREATE POLICY "' : 'DROP POLICY "'),
   "Owner gate must precede Storage policy DDL");
}
for(const token of [
 "executor.query_role=t.owner", "executor.is_superuser", "owner_policy_ddl_ready",
 "executor.query_role AS executor_role"
])assert.ok(diagnostic.includes(token),"Missing live owner-capability check: "+token);
assert.match(proposals.review,/owner_policy_ddl_ready=false/);
assert.match(proposals.review,/cannot execute/i);

assert.match(proposals.apply,/v_public_writable<>0 OR v_public_rpc<>0/);
assert.match(proposals.apply,/v_roles_ok<>3/);
assert.match(proposals.apply,/v_storage_tables<>8 OR v_rls_tables<>8/);
assert.match(proposals.undo,/v_matched<>3 OR v_original_count<>6/);
assert.match(proposals.review,/service_role/);
assert.match(proposals.review,/unapplied/i);
assert.match(proposals.review,/staging_read_only_ready/);
assert.match(proposals.defaults,/future_public_write_grants=40/);
assert.match(proposals.defaults,/future_global_write_grants=2/);
assert.match(proposals.defaults,/\bNO-GO\b/);
assert.match(proposals.defaults,/Storage/);

const scrub=diagnostic.replace(/\/\*[\s\S]*?\*\//g," ")
 .replace(/--[^\n]*/g," ")
 .replace(/'(?:''|[^'])*'/g,"''").trim();
assert.match(scrub,/^WITH\s/i);
assert.equal(scrub.split(";").filter(Boolean).length,1);
assert.doesNotMatch(scrub,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|DO|MERGE|COPY|EXECUTE|SET|RESET|LOCK|VACUUM)\b/i);
for(const marker of [
 "api_role_storage_policy_guard_ready",
 "existing_policy_digest","valid_restrictive_write_policies",
 "expected_role_postures","other_relation_permissive_write_policies",
 "p.polroles @> ARRAY[",
 "polpermissive",
])assert.ok(diagnostic.includes(marker),"Missing SELECT-only readiness requirement: "+marker);
assert.match(diagnostic,/reserved_policy_names=3/);
assert.match(diagnostic,/valid_restrictive_write_policies=3/);
const ownerHandoff = readFileSync(
 new URL("issue71-approved-storage-owner-handoff.md",security),"utf8"
);
assert.match(ownerHandoff,/approved for three named policies only/i);
assert.match(ownerHandoff,/NOT APPLIED/);
assert.match(ownerHandoff,/qihwmfwlhsetxwggaesd/);
assert.match(ownerHandoff,/rquscwgdrqkzwjukiqtk/);
assert.match(ownerHandoff,/owner_policy_ddl_ready/);
assert.match(ownerHandoff,/PERMISSIVE/);
assert.match(ownerHandoff,/RESTRICTIVE/);
assert.match(ownerHandoff,/not equivalent/i);
assert.match(ownerHandoff,/STOP/);
assert.match(ownerHandoff,/separate approval/i);
assert.match(ownerHandoff,/73b4be5cc357949344792320ffff5dc1/);
for (const name of expected.map(x=>x[0]))
 assert.ok(ownerHandoff.includes(name),"Approval handoff must identify "+name);
assert.ok(workflow.includes("docs/security/issue71-approved-storage-owner-handoff.md"),
 "Handoff changes must trigger staging source-only CI");
console.log("PASS: 3 operation-specific Storage RLS review gates and exact inverse, staging SELECT-only acceptance, future grants NO-GO; never applied by CI");
