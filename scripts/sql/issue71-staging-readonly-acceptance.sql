-- ISSUE #71 | STAGING-ONLY READINESS STATUS (SELECT-ONLY)
-- Run only with project_id qihwmfwlhsetxwggaesd, named nhs-os-staging-preview.
-- DO NOT execute against rquscwgdrqkzwjukiqtk (main studio project).
-- This is an observational acceptance query, not a permission migration.
-- EXPECT FALSE UNTIL a separately approved, reversible staging-only grant
-- freeze has been applied and independently verified.
-- This readiness gate includes column-only write grants, mutable public
-- sequences, schema CREATE and database CREATE for API roles. It does not
-- prove a full read-only sandbox; direct Auth and external effects remain.
WITH app AS (
 SELECT COUNT(*)::int AS app_tables,
 COUNT(*) FILTER (WHERE NOT c.relrowsecurity)::int AS missing_rls,
 COUNT(*) FILTER (WHERE NOT has_table_privilege('authenticated', c.oid, 'SELECT'))::int AS missing_admin_reads,
 COUNT(*) FILTER (WHERE
   -- Detect column-only INSERT/UPDATE privileges as well as table-level grants.
   has_any_column_privilege('authenticated', c.oid, 'INSERT, UPDATE') OR
   has_any_column_privilege('anon', c.oid, 'INSERT, UPDATE') OR
   has_table_privilege('authenticated', c.oid, 'DELETE, TRUNCATE') OR
   has_table_privilege('anon', c.oid, 'DELETE, TRUNCATE')
 )::int AS writable_app_tables
 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
), sequences AS (
 SELECT COUNT(*) FILTER (WHERE
   -- nextval/setval are state-changing even when table writes are revoked.
   has_sequence_privilege('authenticated', c.oid, 'USAGE, UPDATE') OR
   has_sequence_privilege('anon', c.oid, 'USAGE, UPDATE')
 )::int AS writable_public_sequences
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='S'
), schemas AS (
 SELECT COUNT(*) FILTER (WHERE
   has_schema_privilege('authenticated', n.oid, 'CREATE') OR
   has_schema_privilege('anon', n.oid, 'CREATE')
 )::int AS create_capable_schemas
 FROM pg_namespace n WHERE n.nspname IN ('public','storage')
), db AS (
 SELECT (has_database_privilege('authenticated', current_database(), 'CREATE') OR
         has_database_privilege('anon', current_database(), 'CREATE'))::int AS api_database_create
), rpc AS (
 SELECT COUNT(*) FILTER (WHERE has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('anon',p.oid,'EXECUTE'))::int AS exposed_public_rpcs
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
), st AS (
 SELECT COUNT(*) FILTER (WHERE
   has_any_column_privilege('authenticated', c.oid, 'INSERT, UPDATE') OR
   has_any_column_privilege('anon', c.oid, 'INSERT, UPDATE') OR
   has_table_privilege('authenticated', c.oid, 'DELETE, TRUNCATE') OR
   has_table_privilege('anon', c.oid, 'DELETE, TRUNCATE')
 )::int AS writable_storage_tables
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relkind='r' AND c.relname IN ('objects','buckets','buckets_analytics')
), defaults AS (
 SELECT COUNT(*)::int AS future_public_write_grants
 FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace JOIN pg_roles ownerrole ON ownerrole.oid=d.defaclrole
 CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
 WHERE n.nspname='public' AND ownerrole.rolname IN ('postgres','supabase_admin')
 AND (acl.grantee=0 OR acl.grantee=(SELECT oid FROM pg_roles WHERE rolname='anon') OR acl.grantee=(SELECT oid FROM pg_roles WHERE rolname='authenticated'))
 AND ((d.defaclobjtype='r' AND acl.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')) OR (d.defaclobjtype='f' AND acl.privilege_type='EXECUTE') OR (d.defaclobjtype='S' AND acl.privilege_type IN ('USAGE','UPDATE')))
)
SELECT app.app_tables, app.missing_rls, app.missing_admin_reads,
 app.writable_app_tables, sequences.writable_public_sequences,
 schemas.create_capable_schemas, db.api_database_create,
 rpc.exposed_public_rpcs, st.writable_storage_tables, defaults.future_public_write_grants,
 (app.app_tables>0 AND app.missing_rls=0 AND app.missing_admin_reads=0
  AND app.writable_app_tables=0 AND sequences.writable_public_sequences=0
  AND schemas.create_capable_schemas=0 AND db.api_database_create=0
  AND rpc.exposed_public_rpcs=0 AND st.writable_storage_tables=0
  AND defaults.future_public_write_grants=0) AS staging_read_only_ready
FROM app CROSS JOIN sequences CROSS JOIN schemas CROSS JOIN db
 CROSS JOIN rpc CROSS JOIN st CROSS JOIN defaults;
