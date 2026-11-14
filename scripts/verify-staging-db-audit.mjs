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
// Preserve an exact, stage-only rollback snapshot before any separately
// authorized ACL freeze. This artifact deliberately cannot alter grants.
const snapshot = readFileSync(new URL("./sql/issue71-staging-acl-snapshot.sql", import.meta.url), "utf8");
assert.match(snapshot, /qihwmfwlhsetxwggaesd/);
assert.match(snapshot, /rquscwgdrqkzwjukiqtk/);
for (const section of [
  "relation_acl", "column_acl", "routine_acl", "schema_acl", "default_acl",
  "api_role_membership", "rls_policy",
]) assert.ok(snapshot.includes(section), "Missing exact rollback snapshot section: " + section);
const cleanedSnapshot = snapshot
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/--[^\n]*/g, " ")
  .replace(/'(?:''|[^'])*'/g, "''");
const snapshotStatements = cleanedSnapshot.split(";").map(x => x.trim()).filter(Boolean);
assert.equal(snapshotStatements.length, 7, "Expected seven independent catalog SELECT queries");
for (const sql of snapshotStatements) {
  assert.match(sql, /^SELECT\s/i, "Rollback snapshot must remain SELECT-only");
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|ALTER|REVOKE|GRANT|CALL|DO|MERGE|COPY|EXECUTE|SET|RESET|LOCK|VACUUM)\b/i,
    "Rollback snapshot includes a potentially state-changing SQL verb");
}

// A table-level check alone misses column-specific INSERT/UPDATE grants.
// Ensure both API roles are checked across app and Storage tables.
for (const role of ["authenticated", "anon"]) {
  const columnProbe = new RegExp("has_any_column_privilege\\('"+role+"', c\\.oid, 'INSERT, UPDATE'\\)", "g");
  assert.equal((readiness.match(columnProbe) ?? []).length, 2,
    "Must inspect column-level writes in both public and Storage: " + role);
  assert.match(readiness, new RegExp("has_sequence_privilege\\('"+role+"', c\\.oid, 'USAGE, UPDATE'\\)"),
    "Must inspect mutating public sequence rights: " + role);
  assert.match(readiness, new RegExp("has_schema_privilege\\('"+role+"', n\\.oid, 'CREATE'\\)"),
    "Must inspect CREATE on public and storage schemas: " + role);
  assert.match(readiness, new RegExp("has_database_privilege\\('"+role+"', current_database\\(\\), 'CREATE'\\)"),
    "Must inspect database-level CREATE: " + role);
}
for (const column of [
  "writable_public_sequences", "create_capable_schemas", "api_database_create",
]) {
  assert.match(readiness, new RegExp(column + "=0"),
    "Read-only readiness must fail if " + column + " remains nonzero");
}
assert.ok(readiness.includes("n.nspname='public' AND c.relkind='S'"),
  "Public sequence query must be present");

console.log("PASS: Issue #71 catalog audit, readiness and exact ACL rollback snapshot queries are observational-only and stage-scoped; no hosted writes");
