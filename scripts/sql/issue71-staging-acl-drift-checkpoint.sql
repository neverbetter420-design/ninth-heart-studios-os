-- ISSUE #71 | STAGING ACL DRIFT CHECKPOINT | SELECT-ONLY
-- Target: qihwmfwlhsetxwggaesd (nhs-os-staging-preview) ONLY.
-- Never target: rquscwgdrqkzwjukiqtk (production/studio).
-- Verify project ID in the connector BEFORE running; current_database() is not an identity check.
-- Capture all rows and store the result privately alongside the seven exact ACL snapshots.
-- This compact fingerprint detects accidental drift; it is NOT a backup or rollback script.
-- Run (1) just before separately approved freeze, (2) at authorized rollback
-- preflight, and (3) after authorized rollback. Compare (1) and (3).
-- Changed ACLs are EXPECTED during the freeze; do not compare (1) and (2)
-- as though equality were required. Do not run any GRANT/REVOKE or migrations.
WITH observed AS (
 SELECT 'relation_acl'::text AS section,
  format('%I.%I',n.nspname,c.relname) AS object_identity,
  jsonb_build_object('kind',c.relkind::text,'owner',pg_get_userbyid(c.relowner),
   'acl',c.relacl::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity)::text AS evidence
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','f','S')

 UNION ALL
 SELECT 'column_acl',format('%I.%I.%I',n.nspname,c.relname,a.attname),
  jsonb_build_object('attnum',a.attnum,'acl',a.attacl::text,
    'type',format_type(a.atttypid,a.atttypmod))::text
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','storage')
 AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped

 UNION ALL
 SELECT 'routine_acl',
  format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),
  jsonb_build_object('kind',p.prokind::text,'owner',pg_get_userbyid(p.proowner),
   'acl',p.proacl::text,'security_definer',p.prosecdef)::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','storage')

 UNION ALL
 SELECT 'schema_acl',quote_ident(n.nspname),
  jsonb_build_object('owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl::text)::text
 FROM pg_namespace n WHERE n.nspname IN ('public','storage')

 UNION ALL
 SELECT 'database_acl',quote_ident(d.datname),
  jsonb_build_object('owner',pg_get_userbyid(d.datdba),'acl',d.datacl::text)::text
 FROM pg_database d WHERE d.datname=current_database()

 UNION ALL
 SELECT 'default_acl',
  format('%s/%I/%s',COALESCE(quote_ident(n.nspname),'<GLOBAL>'),r.rolname,d.defaclobjtype),
  jsonb_build_object('acl',d.defaclacl::text)::text
 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
 LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE n.nspname IN ('public','storage') OR d.defaclnamespace=0

 UNION ALL
 SELECT 'global_default_effective',
  format('%I/%s',r.rolname,k.catalog_kind),
  jsonb_build_object('effective_acl',
   COALESCE(d.defaclacl,acldefault(k.builtin_kind,r.oid))::text)::text
 FROM pg_roles r
 CROSS JOIN (VALUES ('r'::"char",'r'::"char"),
  ('f'::"char",'f'::"char"),('S'::"char",'s'::"char")) k(catalog_kind,builtin_kind)
 LEFT JOIN pg_default_acl d ON d.defaclrole=r.oid AND d.defaclnamespace=0
  AND d.defaclobjtype=k.catalog_kind
 WHERE r.rolname IN ('postgres','supabase_admin')

 UNION ALL
 SELECT 'role_membership',
  format('%I->%I',member.rolname,granted.rolname),
  jsonb_build_object('admin',m.admin_option,'inherit',m.inherit_option,
   'set',m.set_option)::text
 FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
 JOIN pg_roles granted ON granted.oid=m.roleid

 UNION ALL
 SELECT 'rls_policy',format('%I.%I.%I',p.schemaname,p.tablename,p.policyname),
  jsonb_build_object('permissive',p.permissive,'roles',p.roles::text,
   'cmd',p.cmd,'qual',p.qual,'with_check',p.with_check)::text
 FROM pg_policies p WHERE p.schemaname IN ('public','storage')
)
SELECT section.section_name AS snapshot_section,
 count(o.object_identity)::integer AS object_count,
 md5(COALESCE(string_agg(o.object_identity || chr(31) || o.evidence,
  chr(30) ORDER BY o.object_identity),''))
  AS snapshot_fingerprint
FROM (VALUES
 ('relation_acl'),('column_acl'),('routine_acl'),('schema_acl'),
 ('database_acl'),('default_acl'),('global_default_effective'),
 ('role_membership'),('rls_policy')
) AS section(section_name)
LEFT JOIN observed o ON o.section=section.section_name
GROUP BY section.section_name ORDER BY section.section_name;
