-- ISSUE #71 | STAGING PERMISSION ORIGIN INVENTORY | SELECT-ONLY
-- Run ONLY for qihwmfwlhsetxwggaesd / nhs-os-staging-preview.
-- Never run on production rquscwgdrqkzwjukiqtk.
-- Verify project ID through Supabase before executing, not current_database().
-- Catalog metadata only. These checks do NOT modify any ACL, data or service.
-- Save full output privately. ACL entries and effective privileges differ.
--
-- 1) Direct relation write grants and their original grantors.
-- Inspect grantor roles before planning any stage-only revoke/rollback.
SELECT n.nspname AS schema_name,
 CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE COALESCE(grantee.rolname,'<unknown>') END AS grantee,
 COALESCE(grantor.rolname,'<unknown>') AS grantor,
 g.privilege_type, COUNT(*)::int AS grant_entries,
 COUNT(DISTINCT c.oid)::int AS relation_count
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) g
LEFT JOIN pg_roles grantee ON grantee.oid=g.grantee
LEFT JOIN pg_roles grantor ON grantor.oid=g.grantor
WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p')
AND (g.grantee=0 OR grantee.rolname IN ('anon','authenticated'))
AND g.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','MAINTAIN','REFERENCES')
GROUP BY n.nspname,g.grantee,grantee.rolname,grantor.rolname,g.privilege_type
ORDER BY schema_name,grantee,privilege_type,grantor;

-- 2) Exact public function identities and present execution status.
-- Existence of an executable routine does not prove a successful write.
SELECT format('%I.%I(%s)',n.nspname,p.proname,
 pg_get_function_identity_arguments(p.oid)) AS routine,
p.prokind::text AS routine_kind,p.prosecdef AS security_definer,
pg_get_userbyid(p.proowner) AS owner_role,
p.proacl IS NULL AS uses_builtin_acl,p.proacl::text AS raw_acl,
has_function_privilege('anon',p.oid,'EXECUTE') AS anon_can_execute,
has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind IN ('f','p')
ORDER BY p.proname,pg_get_function_identity_arguments(p.oid);

-- 3) Source of future write grants across public AND storage schemas.
-- Global defaults may require COALESCE with acldefault() separately;
-- use issue71-staging-readonly-acceptance.sql for effective global values.
SELECT COALESCE(n.nspname,'<GLOBAL>') AS schema_scope,
 owner.rolname AS creator,d.defaclobjtype::text AS object_kind,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE COALESCE(grantee.rolname,'<unknown>') END AS grantee,
 a.privilege_type,COUNT(*)::int AS acl_entries
FROM pg_default_acl d JOIN pg_roles owner ON owner.oid=d.defaclrole
LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
WHERE (n.nspname IN ('public','storage') OR d.defaclnamespace=0)
 AND owner.rolname IN ('postgres','supabase_admin')
 AND (a.grantee=0 OR grantee.rolname IN ('anon','authenticated'))
 AND ((d.defaclobjtype='r' AND a.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'))
 OR (d.defaclobjtype='f' AND a.privilege_type='EXECUTE')
 OR (d.defaclobjtype='S' AND a.privilege_type IN ('USAGE','UPDATE')))
GROUP BY n.nspname,owner.rolname,d.defaclobjtype,a.grantee,grantee.rolname,a.privilege_type
ORDER BY schema_scope,creator,object_kind,grantee,privilege_type;

-- 4) Storage policy operation and scope summary (no object data).
SELECT p.tablename,p.policyname,p.cmd,p.roles::text AS roles,
 p.qual IS NOT NULL AS has_using,p.with_check IS NOT NULL AS has_check
FROM pg_policies p WHERE p.schemaname='storage'
ORDER BY p.tablename,p.policyname;
