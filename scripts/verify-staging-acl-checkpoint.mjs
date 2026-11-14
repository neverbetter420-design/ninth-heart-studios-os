import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("./sql/issue71-staging-acl-drift-checkpoint.sql", import.meta.url), "utf8");
const runbook = readFileSync(new URL("../docs/security/issue71-stage-freeze-approval-gates.md", import.meta.url), "utf8");

// SQL is a read-only diagnostic: no backend calls, grants, or migrations.
// The project ID is an instruction to the operator, NOT an in-SQL identity assertion.
assert.match(sql, /qihwmfwlhsetxwggaesd/);
assert.match(sql, /rquscwgdrqkzwjukiqtk/);
assert.match(runbook, /qihwmfwlhsetxwggaesd/);
assert.match(runbook, /rquscwgdrqkzwjukiqtk/);
assert.match(runbook, /separate\s+authorization/i);
assert.match(runbook, /rollback/i);
assert.match(runbook, /NOT APPLIED/);

const cleaned = sql
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n]*/g, " ")
  .replace(/'(?:''|[^'])*'/g, "''")
  .trim();
assert.match(cleaned, /^WITH\s+observed\s+AS\s*\(/i);
assert.match(cleaned, /SELECT\s+section\.section_name AS snapshot_section/);
assert.equal(cleaned.split(";").filter(x => x.trim()).length, 1, "One SELECT query only");
assert.doesNotMatch(cleaned,
  /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|DO|MERGE|COPY|EXECUTE|SET|RESET|LOCK|VACUUM|SECURITY\s+DEFINER|pg_sleep|dblink|pg_read_file)\b/i,
  "The checkpoint must never contain a write-capable SQL operation");

// Every relevant ACL layer is tracked. PostgreSQL NULL ACL is distinct from
// an empty ACL; jsonb_build_object serializes SQL NULL explicitly.
for (const marker of [
  "c.relacl::text", "a.attacl::text", "p.proacl::text",
  "n.nspacl::text", "d.datacl::text", "d.defaclacl::text",
  "acldefault(k.builtin_kind,r.oid)", "pg_auth_members", "pg_policies",
  "c.relrowsecurity", "c.relforcerowsecurity", "p.prosecdef",
  "d.defaclnamespace=0", "jsonb_build_object",
  "string_agg", "md5(", "ORDER BY o.object_identity",
]) assert.ok(sql.includes(marker), "Drift checkpoint missing " + marker);

const sections = [
  "relation_acl", "column_acl", "routine_acl", "schema_acl",
  "database_acl", "default_acl", "global_default_effective",
  "role_membership", "rls_policy",
];
for (const section of sections) {
  assert.match(sql, new RegExp("\\('" + section + "'\\)"),
    "Missing guaranteed result row for " + section);
}
assert.match(sql, /LEFT JOIN observed o ON o\.section=section\.section_name/);
assert.match(sql, /count\(o\.object_identity\)/);
assert.match(runbook, /nine/i);
console.log("PASS: nine-section staging ACL drift checkpoint is catalog-only, SELECT-only, and approval-gated; no hosted writes");
