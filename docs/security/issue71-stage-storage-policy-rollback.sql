-- ISSUE #71 | STAGE STORAGE POLICY REVIEW ROLLBACK | PROPOSAL ONLY
-- Stage ONLY: qihwmfwlhsetxwggaesd / nhs-os-staging-preview.
-- Never production: rquscwgdrqkzwjukiqtk.
-- NOT APPLIED: use only after separate approval and exact preflight.
-- Reverses only the three proposed restrictive policies. Does not touch
-- original permissive policies, existing Storage grants, service_role or Auth.
BEGIN;
DO $review_rollback_preflight$
DECLARE
 v_matched integer;
 v_all integer;
 v_original_count integer;
 v_original_digest text;
 v_executor text;
 v_owner text;
 v_executor_superuser boolean;
BEGIN
 -- Do not attempt DROP POLICY from the postgres connector role:
 -- only a verified owner/superuser can alter storage.objects policies.
 SELECT pg_get_userbyid(c.relowner) INTO v_owner
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname='objects' AND c.relkind='r';
 SELECT current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 INTO v_executor,v_executor_superuser;
 IF v_owner IS DISTINCT FROM 'supabase_storage_admin'
    OR NOT (v_executor=v_owner OR COALESCE(v_executor_superuser,false))
 THEN
   RAISE EXCEPTION 'STOP: Storage policy rollback executor is not table owner; no policy mutation';
 END IF;
 SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE
   NOT p.polpermissive AND
   p.polroles @> ARRAY[
    (SELECT oid FROM pg_roles WHERE rolname='anon'),
    (SELECT oid FROM pg_roles WHERE rolname='authenticated')]::oid[]
   AND ((p.polname='nhs_review_deny_storage_insert' AND p.polcmd='a'
     AND p.polqual IS NULL AND pg_get_expr(p.polwithcheck,p.polrelid)='false')
   OR (p.polname='nhs_review_deny_storage_update' AND p.polcmd='w'
     AND pg_get_expr(p.polqual,p.polrelid)='false'
     AND pg_get_expr(p.polwithcheck,p.polrelid)='false')
   OR (p.polname='nhs_review_deny_storage_delete' AND p.polcmd='d'
     AND pg_get_expr(p.polqual,p.polrelid)='false' AND p.polwithcheck IS NULL)))::int
   INTO v_all,v_matched
 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname='objects'
   AND p.polname IN ('nhs_review_deny_storage_insert',
     'nhs_review_deny_storage_update','nhs_review_deny_storage_delete');
 SELECT COUNT(*)::int,
    md5(COALESCE(string_agg(
      policyname || chr(31) || cmd || chr(31) || permissive || chr(31) ||
      roles::text || chr(31) || COALESCE(qual,'<NULL>') || chr(31) ||
      COALESCE(with_check,'<NULL>'),
      chr(30) ORDER BY policyname),''))
 INTO v_original_count,v_original_digest
 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
   AND policyname NOT IN ('nhs_review_deny_storage_insert',
     'nhs_review_deny_storage_update','nhs_review_deny_storage_delete');
 IF v_all<>3 OR v_matched<>3 OR v_original_count<>6
 OR v_original_digest<>'73b4be5cc357949344792320ffff5dc1' THEN
  RAISE EXCEPTION 'STOP: Stage storage policy rollback drift, do not drop anything';
 END IF;
END
$review_rollback_preflight$;

DROP POLICY "nhs_review_deny_storage_insert" ON storage.objects;
DROP POLICY "nhs_review_deny_storage_update" ON storage.objects;
DROP POLICY "nhs_review_deny_storage_delete" ON storage.objects;

DO $review_rollback_postcondition$
DECLARE v_count integer;v_digest text;
BEGIN
 SELECT COUNT(*)::int,
    md5(COALESCE(string_agg(
      policyname || chr(31) || cmd || chr(31) || permissive || chr(31) ||
      roles::text || chr(31) || COALESCE(qual,'<NULL>') || chr(31) ||
      COALESCE(with_check,'<NULL>'),
      chr(30) ORDER BY policyname),''))
 INTO v_count,v_digest
 FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
 IF v_count<>6 OR v_digest<>'73b4be5cc357949344792320ffff5dc1' THEN
  RAISE EXCEPTION 'STOP: Stage Storage rollback did not restore original six policies';
 END IF;
END
$review_rollback_postcondition$;
COMMIT;
