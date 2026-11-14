-- ISSUE #71 | STORAGE.OBJECTS REVIEW FREEZE | PROPOSAL ONLY | NOT APPLIED
-- Isolated Supabase staging ONLY: qihwmfwlhsetxwggaesd (nhs-os-staging-preview).
-- NEVER production: rquscwgdrqkzwjukiqtk.
-- Requires a NEW, separately scoped owner approval and Storage compatibility review.
-- Not in supabase/migrations; not executed by CI or this draft.
-- PostgreSQL 17 operation-specific RESTRICTIVE RLS gates:
-- forbid INSERT, UPDATE, DELETE for anon/authenticated, preserve SELECT.
-- Storage API owner supabase_storage_admin and service_role remain untouched.
-- Direct service-role/owner calls, S3 backends and Auth still need separate review.
BEGIN;
DO $review_preflight$
DECLARE
  v_owner text;
  v_rls boolean;
  v_force_rls boolean;
  v_storage_tables integer;
  v_rls_tables integer;
  v_existing_policy_count integer;
  v_existing_policy_digest text;
  v_roles_ok integer;
  v_public_writable integer;
  v_public_rpc integer;
  v_executor text;
  v_executor_superuser boolean;
BEGIN
  SELECT pg_get_userbyid(c.relowner),c.relrowsecurity,c.relforcerowsecurity
    INTO v_owner,v_rls,v_force_rls
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='storage' AND c.relname='objects' AND c.relkind='r';
  SELECT COUNT(*)::int,COUNT(*) FILTER (WHERE c.relrowsecurity)::int
    INTO v_storage_tables,v_rls_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='storage' AND c.relkind IN ('r','p');
  SELECT COUNT(*)::int,
    md5(COALESCE(string_agg(
      policyname || chr(31) || cmd || chr(31) || permissive || chr(31) ||
      roles::text || chr(31) || COALESCE(qual,'<NULL>') || chr(31) ||
      COALESCE(with_check,'<NULL>'),
      chr(30) ORDER BY policyname),''))
    INTO v_existing_policy_count,v_existing_policy_digest
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects';
  SELECT COUNT(*)::int INTO v_roles_ok
  FROM pg_roles WHERE (rolname IN ('anon','authenticated') AND NOT rolbypassrls)
    OR (rolname='service_role' AND rolbypassrls);
  SELECT COUNT(*)::int INTO v_public_writable
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND (has_any_column_privilege('anon',c.oid,'INSERT, UPDATE')
      OR has_any_column_privilege('authenticated',c.oid,'INSERT, UPDATE')
      OR has_table_privilege('anon',c.oid,'DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN')
      OR has_table_privilege('authenticated',c.oid,'DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'));
  SELECT COUNT(*)::int INTO v_public_rpc
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind IN ('f','p')
    AND (has_function_privilege('anon',p.oid,'EXECUTE')
      OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
  -- Creating policies requires table ownership. The usual Supabase MCP
  -- executor is postgres: it neither owns storage.objects nor is superuser.
  -- Fail before the first CREATE POLICY; do not elevate or change ownership.
  SELECT current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
    INTO v_executor,v_executor_superuser;
  IF v_owner IS DISTINCT FROM 'supabase_storage_admin'
    OR NOT (v_executor=v_owner OR COALESCE(v_executor_superuser,false))
    OR NOT COALESCE(v_rls,false)
    OR COALESCE(v_force_rls,true) OR v_storage_tables<>8 OR v_rls_tables<>8
    OR v_existing_policy_count<>6
    OR v_existing_policy_digest<>'73b4be5cc357949344792320ffff5dc1'
    OR v_roles_ok<>3 OR v_public_writable<>0 OR v_public_rpc<>0
  THEN
    RAISE EXCEPTION 'STOP: Stage Storage policy preflight mismatch. No policy changes permitted';
  END IF;
END
$review_preflight$;

CREATE POLICY "nhs_review_deny_storage_insert"
  ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "nhs_review_deny_storage_update"
  ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "nhs_review_deny_storage_delete"
  ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (false);

DO $review_postcondition$
DECLARE
 v_matched integer;
 v_original_count integer;
 v_original_digest text;
BEGIN
 SELECT COUNT(*)::int INTO v_matched
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname='objects'
   AND p.polname IN ('nhs_review_deny_storage_insert',
     'nhs_review_deny_storage_update','nhs_review_deny_storage_delete')
   AND NOT p.polpermissive
   AND p.polroles @> ARRAY[
     (SELECT oid FROM pg_roles WHERE rolname='anon'),
     (SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
   AND ((p.polname='nhs_review_deny_storage_insert'
     AND p.polcmd='a' AND p.polqual IS NULL
     AND pg_get_expr(p.polwithcheck,p.polrelid)='false')
    OR (p.polname='nhs_review_deny_storage_update'
     AND p.polcmd='w' AND pg_get_expr(p.polqual,p.polrelid)='false'
     AND pg_get_expr(p.polwithcheck,p.polrelid)='false')
    OR (p.polname='nhs_review_deny_storage_delete'
     AND p.polcmd='d' AND pg_get_expr(p.polqual,p.polrelid)='false'
     AND p.polwithcheck IS NULL));
 SELECT COUNT(*)::int,
    md5(COALESCE(string_agg(
      policyname || chr(31) || cmd || chr(31) || permissive || chr(31) ||
      roles::text || chr(31) || COALESCE(qual,'<NULL>') || chr(31) ||
      COALESCE(with_check,'<NULL>'),
      chr(30) ORDER BY policyname),''))
 INTO v_original_count,v_original_digest
 FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects'
 AND policyname NOT IN ('nhs_review_deny_storage_insert',
   'nhs_review_deny_storage_update','nhs_review_deny_storage_delete');
 IF v_matched<>3 OR v_original_count<>6
    OR v_original_digest<>'73b4be5cc357949344792320ffff5dc1'
 THEN
   RAISE EXCEPTION 'STOP: Stage Storage restrictive policy postcondition failed';
 END IF;
END
$review_postcondition$;
COMMIT;
