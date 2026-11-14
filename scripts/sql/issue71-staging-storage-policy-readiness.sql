-- ISSUE #71 | STAGING STORAGE RLS REVIEW STATUS | SELECT ONLY
-- Execute ONLY on qihwmfwlhsetxwggaesd / nhs-os-staging-preview.
-- NEVER on rquscwgdrqkzwjukiqtk. Project identity must be checked
-- in the connector; SQL current_database() is not a Supabase project ID.
-- This is role-specific RLS evidence, not proof of API/storage/S3 behavior.
WITH target AS (
 SELECT c.oid AS object_oid,c.relrowsecurity,c.relforcerowsecurity,
 pg_get_userbyid(c.relowner) AS owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname='objects' AND c.relkind='r'
), storage_tables AS (
 SELECT COUNT(*)::int AS storage_relations,
 COUNT(*) FILTER (WHERE c.relrowsecurity)::int AS rls_relations
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relkind IN ('r','p')
), roles AS (
 SELECT COUNT(*) FILTER (WHERE (rolname IN ('anon','authenticated')
    AND NOT rolbypassrls) OR (rolname='service_role' AND rolbypassrls))::int
 AS expected_role_postures
 FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
), policies AS (
 SELECT COUNT(*) FILTER (WHERE p.polname IN (
   'nhs_review_deny_storage_insert',
   'nhs_review_deny_storage_update',
   'nhs_review_deny_storage_delete'))::int AS reserved_policy_names,
 COUNT(*) FILTER (WHERE NOT p.polpermissive
   AND p.polroles @> ARRAY[
    (SELECT oid FROM pg_roles WHERE rolname='anon'),
    (SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
   AND ((p.polname='nhs_review_deny_storage_insert' AND p.polcmd='a'
     AND p.polqual IS NULL
     AND pg_get_expr(p.polwithcheck,p.polrelid)='false')
    OR (p.polname='nhs_review_deny_storage_update' AND p.polcmd='w'
     AND pg_get_expr(p.polqual,p.polrelid)='false'
     AND pg_get_expr(p.polwithcheck,p.polrelid)='false')
    OR (p.polname='nhs_review_deny_storage_delete' AND p.polcmd='d'
     AND pg_get_expr(p.polqual,p.polrelid)='false'
     AND p.polwithcheck IS NULL)))::int AS valid_restrictive_write_policies
 FROM pg_policy p JOIN target t ON t.object_oid=p.polrelid
), originals AS (
 SELECT COUNT(*)::int AS existing_policy_count,
 md5(COALESCE(string_agg(
  policyname || chr(31) || cmd || chr(31) || permissive || chr(31) ||
  roles::text || chr(31) || COALESCE(qual,'<NULL>') || chr(31) ||
  COALESCE(with_check,'<NULL>'),
  chr(30) ORDER BY policyname),'')) AS existing_policy_digest
 FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects'
 AND policyname NOT IN (
  'nhs_review_deny_storage_insert',
  'nhs_review_deny_storage_update',
  'nhs_review_deny_storage_delete')
), other_write_policies AS (
 SELECT COUNT(*)::int AS other_relation_permissive_write_policies
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname<>'objects'
  AND p.polpermissive AND p.polcmd IN ('*','a','w','d')
)
SELECT t.owner AS storage_objects_owner,t.relrowsecurity AS rls_enabled,
 t.relforcerowsecurity AS rls_forced,
 st.storage_relations,st.rls_relations,
 roles.expected_role_postures,
 policies.reserved_policy_names,policies.valid_restrictive_write_policies,
 originals.existing_policy_count, originals.existing_policy_digest,
 other_write_policies.other_relation_permissive_write_policies,
 (t.owner='supabase_storage_admin'
  AND t.relrowsecurity AND NOT t.relforcerowsecurity
  AND st.storage_relations=8 AND st.rls_relations=8
  AND roles.expected_role_postures=3
  AND policies.reserved_policy_names=3
  AND policies.valid_restrictive_write_policies=3
  AND originals.existing_policy_count=6
  AND originals.existing_policy_digest='73b4be5cc357949344792320ffff5dc1'
  AND other_write_policies.other_relation_permissive_write_policies=0)
 AS api_role_storage_policy_guard_ready
FROM target t CROSS JOIN storage_tables st CROSS JOIN roles
 CROSS JOIN policies CROSS JOIN originals CROSS JOIN other_write_policies;
