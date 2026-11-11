-- ISSUE #71 | NON-MUTATING METADATA AUDIT ONLY
-- Run ONLY with an explicitly selected project_id qihwmfwlhsetxwggaesd
-- after verifying its project name nhs-os-staging-preview.
-- This file contains catalog SELECTs; it must never write application data.
-- Current observed baseline as of 2026-11-11: 32 RLS public tables,
-- 32 auth INSERT and UPDATE grants, 31 auth DELETE grants,
-- 6 public authenticated-executable mutating functions,
-- and storage.objects authenticated write grants.

SELECT 'public_tables' AS audit_section,
  COUNT(*) AS tables,
  COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled,
  COUNT(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'SELECT')) AS auth_select,
  COUNT(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'INSERT')) AS auth_insert,
  COUNT(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'UPDATE')) AS auth_update,
  COUNT(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'DELETE')) AS auth_delete,
  COUNT(*) FILTER (WHERE has_table_privilege('anon',c.oid,'INSERT')) AS anon_insert
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p');

SELECT 'public_functions' AS audit_section, p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.proname;

SELECT 'storage_write_grants' AS audit_section, c.relname,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
  has_table_privilege('authenticated',c.oid,'INSERT') AS auth_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') AS auth_update,
  has_table_privilege('authenticated',c.oid,'DELETE') AS auth_delete,
  has_table_privilege('anon',c.oid,'INSERT') AS anon_insert
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='storage' AND c.relkind='r'
ORDER BY c.relname;

SELECT 'storage_policies' AS audit_section, tablename, policyname, cmd,
  roles::text AS roles, permissive
FROM pg_policies WHERE schemaname='storage' AND tablename IN ('objects','buckets')
ORDER BY tablename, cmd, policyname;

SELECT 'default_acl' AS audit_section, n.nspname AS schema_name,
  r.rolname AS creator, a.defaclobjtype AS object_type, a.defaclacl::text AS acl
FROM pg_default_acl a
JOIN pg_roles r ON r.oid=a.defaclrole
LEFT JOIN pg_namespace n ON n.oid=a.defaclnamespace
WHERE n.nspname IN ('public','storage') OR n.nspname IS NULL
ORDER BY schema_name, creator, object_type;

SELECT 'public_policies' AS audit_section, cmd, roles::text AS roles, COUNT(*) AS policies
FROM pg_policies WHERE schemaname='public'
GROUP BY cmd, roles::text ORDER BY cmd, roles::text;

SELECT 'schema_create' AS audit_section, rolname,
  has_schema_privilege(rolname,'public','CREATE') AS public_create,
  has_schema_privilege(rolname,'storage','CREATE') AS storage_create,
  has_database_privilege(rolname,current_database(),'CREATE') AS database_create
FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
ORDER BY rolname;
