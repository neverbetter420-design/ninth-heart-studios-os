-- ISSUE #71 | READ-ONLY, STAGING-ONLY EXACT ACL SNAPSHOT
-- Run ONLY against Supabase project ID qihwmfwlhsetxwggaesd / nhs-os-staging-preview.
-- DO NOT run against the studio project rquscwgdrqkzwjukiqtk.
-- Keep the complete unmodified result as a private pre-change artifact.
-- Preserve explicit NULL ACL values; NULL is not equivalent to an empty ACL.
-- No permission change or rollback is executed by this file.

-- Relations, including public app objects and Storage objects.
SELECT 'relation_acl' AS snapshot_section,
       format('%I.%I', n.nspname, c.relname) AS object_identity,
       pg_get_userbyid(c.relowner) AS owner_role,
       c.relkind::text AS object_kind,
       c.relacl::text AS exact_acl,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
ORDER BY n.nspname, c.relname;

-- Function signatures matter: overloaded routines must be restored individually.
SELECT 'routine_acl' AS snapshot_section,
       format('%I.%I(%s)', n.nspname, p.proname,
              pg_get_function_identity_arguments(p.oid)) AS object_identity,
       pg_get_userbyid(p.proowner) AS owner_role,
       p.prokind::text AS object_kind,
       p.proacl::text AS exact_acl,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

-- Schema-level ACLs, including PUBLIC/inherited privileges.
SELECT 'schema_acl' AS snapshot_section,
       quote_ident(n.nspname) AS object_identity,
       pg_get_userbyid(n.nspowner) AS owner_role,
       n.nspacl::text AS exact_acl
FROM pg_namespace n
WHERE n.nspname IN ('public', 'storage')
ORDER BY n.nspname;

-- Creator-specific defaults, including NULL-schema (global) defaults.
SELECT 'default_acl' AS snapshot_section,
       COALESCE(quote_ident(n.nspname), '<GLOBAL>') AS schema_scope,
       r.rolname AS creator_role,
       d.defaclobjtype::text AS object_kind,
       d.defaclacl::text AS exact_acl
FROM pg_default_acl d
JOIN pg_roles r ON r.oid = d.defaclrole
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname IN ('public', 'storage') OR d.defaclnamespace = 0
ORDER BY schema_scope, creator_role, object_kind;

-- Effective grants may be inherited, so snapshot memberships of API roles.
SELECT 'api_role_membership' AS snapshot_section,
       role.rolname AS inherited_role,
       member.rolname AS member_role,
       m.admin_option,
       m.inherit_option,
       m.set_option
FROM pg_auth_members m
JOIN pg_roles role ON role.oid = m.roleid
JOIN pg_roles member ON member.oid = m.member
WHERE member.rolname IN ('anon', 'authenticated')
ORDER BY member.rolname, role.rolname;

-- Preserve the exact policy definitions as observational context.
SELECT 'rls_policy' AS snapshot_section,
       schemaname, tablename, policyname, permissive,
       roles::text AS roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;
