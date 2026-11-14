import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  new URL("./sql/issue71-staging-permission-origins.sql", import.meta.url),
  "utf8",
);
const review = readFileSync(
  new URL("../docs/security/issue71-permission-origin-review.md", import.meta.url),
  "utf8",
);

for (const source of [sql, review]) {
  assert.ok(source.includes("qihwmfwlhsetxwggaesd"), "Must identify staging project");
  assert.ok(source.includes("rquscwgdrqkzwjukiqtk"), "Must warn against production project");
}
assert.match(review, /NOT APPLIED/);
assert.match(review, /NO-GO/);
assert.match(review, /separate owner approval/i);
assert.match(review, /rollback/i);

// SQL is never deployed or run by this test. Prohibit state-changing commands
// even inside a CTE and require exactly four top-level catalog SELECTs.
const cleaned = sql
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n]*/g, " ")
  .replace(/'(?:''|[^'])*'/g, "''");
const queries = cleaned.split(";").map(x => x.trim()).filter(Boolean);
assert.equal(queries.length, 4, "Four independent observational catalog queries");
for (const query of queries) {
  assert.match(query, /^SELECT\s/i, "No DML or DDL in the permission origin report");
  assert.doesNotMatch(query,
    /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|DO|MERGE|COPY|EXECUTE|SET|RESET|LOCK|VACUUM|SECURITY\s+DEFINER)\b/i,
    "Permission origin report must be SELECT-only");
}

for (const token of [
  "pg_class", "pg_namespace", "aclexplode",
  "g.grantor", "g.grantee", "g.privilege_type",
  "pg_proc", "prosecdef", "pg_get_function_identity_arguments",
  "has_function_privilege('anon'", "has_function_privilege('authenticated'",
  "pg_default_acl", "d.defaclnamespace", "pg_policies",
  "n.nspname IN ('public','storage')", "owner.rolname IN ('postgres','supabase_admin')",
  "grantee.rolname IN ('anon','authenticated')", "p.schemaname='storage'",
]) {
  assert.ok(sql.includes(token), "Missing required permission-origin evidence: " + token);
}
for (const token of [
  "32/32", "19/32", "6/8", "supabase_storage_admin",
  "handle_new_user()", "set_updated_at()",
  "future", "global", "RLS", "Storage",
]) {
  assert.ok(review.includes(token), "Missing current staging impact evidence: " + token);
}
assert.ok(!/\b(?:executed|applied)\s+(?:a\s+)?(?:GRANT|REVOKE|migration)\b/i.test(review),
  "Review must not imply ACL mutations were executed");
console.log("PASS staging permission-origin report and approval runbook; four SELECT-only catalog checks, zero permission changes");
