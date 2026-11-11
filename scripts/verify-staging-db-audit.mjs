import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const audit = readFileSync(new URL("./sql/issue71-staging-acl-audit.sql", import.meta.url), "utf8");
const doc = readFileSync(new URL("../docs/security/issue71-staging-database-write-freeze.md", import.meta.url), "utf8");
assert.match(doc, /source-only proposal/i);
assert.match(doc, /NOT APPLIED/);
assert.match(doc, /qihwmfwlhsetxwggaesd/);
assert.match(doc, /rquscwgdrqkzwjukiqtk/);
assert.match(doc, /Never target/i);
assert.match(audit, /qihwmfwlhsetxwggaesd/);

// Drop SQL comments and single-quoted string literals before checking
// for mutation verbs. Read-only catalog functions are permitted.
const unquoted = audit
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n]*/g, " ")
  .replace(/'(?:''|[^'])*'/g, "''");
const statements = unquoted.split(";").map(x => x.trim()).filter(Boolean);
assert.ok(statements.length >= 7, "Expected repeatable privilege sections");
for (const sql of statements) {
  assert.match(sql, /^SELECT\s/i, "Only SELECT catalog queries may appear in this audit file");
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|DO|MERGE|COPY|EXECUTE|SET|RESET|LOCK|VACUUM)\b/i,
    "Potentially state-changing SQL is forbidden in the metadata audit file");
}
// The readiness query may use WITH + SELECT CTEs; ban any mutating SQL.
const readiness = readFileSync(new URL("./sql/issue71-staging-readonly-acceptance.sql", import.meta.url), "utf8");
assert.match(readiness, /qihwmfwlhsetxwggaesd/);
const sanitized = readiness.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ").replace(/'(?:''|[^'])*'/g, "''").trim();
assert.match(sanitized, /^WITH\s/i);
assert.match(sanitized, /\bSELECT\s+app\.app_tables\b/);
assert.doesNotMatch(sanitized, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|DO|MERGE|COPY|SET|RESET|LOCK|VACUUM)\b/i);
assert.match(readiness, /staging_read_only_ready/);
assert.match(readiness, /future_public_write_grants/);
assert.match(readiness, /writable_storage_tables/);
assert.match(readiness, /exposed_public_rpcs/);
const required = [
  "pg_class", "pg_proc", "pg_default_acl", "pg_policies",
  "has_table_privilege", "has_function_privilege",
  "relrowsecurity", "authenticated", "anon", "storage", "public",
];
for (const token of required) assert.ok(audit.includes(token), "Missing audit metadata: " + token);
console.log("PASS: Issue #71 catalog audit and readiness queries are observational-only and stage-scoped; no hosted writes");
