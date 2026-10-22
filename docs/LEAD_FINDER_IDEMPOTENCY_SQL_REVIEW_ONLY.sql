-- REVIEW ONLY. Do not run in production without a separate owner approval.
-- NHS Lead Finder 2.0: database-enforced idempotency across separate searches.
-- This is a PROPOSAL, not a Supabase migration. After preflight + owner
-- approval, generate a new migration with `supabase migration new`, copy
-- the approved statements there, then execute and verify them separately.
--
-- The application records metadata.source_ref and metadata.import_key only for
-- imported Lead Finder v2 leads. Separate addresses remain distinct even when
-- a brand domain is shared; imports without an address use name + domain.
-- Exact source identity provides a second independent deduplication guard.
--
-- Preflight: each query must produce ZERO rows. Investigate any duplicates;
-- do not delete or modify existing leads automatically.
SELECT metadata->>'source_ref' AS source_ref, count(*) AS duplicates
FROM public.leads
WHERE metadata->>'source' = 'nhs_lead_finder_v2'
  AND nullif(metadata->>'source_ref','') IS NOT NULL
GROUP BY metadata->>'source_ref' HAVING count(*) > 1;

SELECT metadata->>'import_key' AS import_key, count(*) AS duplicates
FROM public.leads
WHERE metadata->>'source' = 'nhs_lead_finder_v2'
  AND nullif(metadata->>'import_key','') IS NOT NULL
GROUP BY metadata->>'import_key' HAVING count(*) > 1;

-- DRAFT DDL. NO PROD APPROVAL GIVEN.
CREATE UNIQUE INDEX IF NOT EXISTS nhs_lead_finder_source_ref_once
ON public.leads ((metadata->>'source_ref'))
WHERE metadata->>'source' = 'nhs_lead_finder_v2'
  AND nullif(metadata->>'source_ref','') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS nhs_lead_finder_import_key_once
ON public.leads ((metadata->>'import_key'))
WHERE metadata->>'source' = 'nhs_lead_finder_v2'
  AND nullif(metadata->>'import_key','') IS NOT NULL;

-- Post-apply read-only verification: both indexes exist, are valid and unique.
SELECT indexrelid::regclass::text AS index_name, indisunique, indisvalid
FROM pg_index
WHERE indexrelid IN (
  'public.nhs_lead_finder_source_ref_once'::regclass,
  'public.nhs_lead_finder_import_key_once'::regclass
);

-- This does not prevent duplicates inserted by other CRM entry points or
-- provider records with mismatched name/address and differing source IDs.
-- The existing in-app duplicate review remains mandatory.
