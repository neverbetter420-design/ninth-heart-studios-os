-- Document integrity guards for client form and contract updates; generated from verified live functions.

CREATE OR REPLACE FUNCTION private.guard_client_contract_signature()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  signed_iso text;
begin
  if (select private.is_admin()) then
    return new;
  end if;
  if (select auth.uid()) is null
     or old.status <> 'sent' or new.status <> 'signed'
     or to_jsonb(new) - array['status','signed_at','signer_name','signer_email','signature_hash','signer_ip','updated_at']
        is distinct from
        to_jsonb(old) - array['status','signed_at','signer_name','signer_email','signature_hash','signer_ip','updated_at']
  then
    raise exception 'Invalid contract signature transition or protected-field update' using errcode = '42501';
  end if;
  new.signer_name := nullif(pg_catalog.btrim(new.signer_name), '');
  new.signer_email := pg_catalog.lower(nullif(pg_catalog.btrim(new.signer_email), ''));
  if new.signer_name is null or new.signer_email is null
     or new.signer_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Valid signer name and email required' using errcode = '23514';
  end if;
  new.signed_at := pg_catalog.clock_timestamp();
  new.updated_at := new.signed_at;
  signed_iso := pg_catalog.to_char(new.signed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  new.signature_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(new.body || '::' || new.signer_email || '::' || signed_iso, 'UTF8')), 'hex');
  -- Request-provided X-Forwarded-For is not a verified audit source.
  new.signer_ip := null;
  return new;
end;
$function$


DROP TRIGGER IF EXISTS guard_client_contract_signature ON public.contracts;

CREATE TRIGGER guard_client_contract_signature BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION private.guard_client_contract_signature();

CREATE OR REPLACE FUNCTION private.guard_client_form_submission()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  defs jsonb;
  field jsonb;
  field_id text;
  typ text;
  val jsonb;
  item jsonb;
  item_qty numeric;
  item_price numeric;
  computed_total numeric := 0;
  is_required boolean;
  needs_signature boolean := false;
  signed_iso text;
  value_key text;
begin
  if (select private.is_admin()) then
    return new;
  end if;
  if (select auth.uid()) is null
     or old.status <> 'pending' or new.status <> 'submitted'
     or to_jsonb(new) - array['status','values','total_cents','submitted_at','signer_name','signer_email','signature_hash','signer_ip','updated_at']
        is distinct from
        to_jsonb(old) - array['status','values','total_cents','submitted_at','signer_name','signer_email','signature_hash','signer_ip','updated_at']
  then
    raise exception 'Invalid form submission transition or protected-field update' using errcode = '42501';
  end if;

  if new.values is null or pg_catalog.jsonb_typeof(new.values) <> 'object' then
    raise exception 'Form values must be a JSON object' using errcode = '23514';
  end if;
  select fields into defs from public.form_templates where id = old.template_id;
  if defs is null or pg_catalog.jsonb_typeof(defs) <> 'array' then
    raise exception 'Form template unavailable' using errcode = '23514';
  end if;

  for value_key in select pg_catalog.jsonb_object_keys(new.values)
  loop
    if not exists (select 1 from pg_catalog.jsonb_array_elements(defs) f where f->>'id' = value_key) then
      raise exception 'Unrecognized form value key' using errcode = '23514';
    end if;
  end loop;

  for field in select value from pg_catalog.jsonb_array_elements(defs)
  loop
    field_id := field->>'id';
    typ := field->>'type';
    is_required := coalesce((field->>'required')::boolean, false);
    val := new.values -> field_id;
    if typ = 'signature' then
      needs_signature := true;
    elsif is_required and
       (val is null or val = 'null'::jsonb
        or (pg_catalog.jsonb_typeof(val) = 'string' and pg_catalog.btrim(val #>> '{}') = '')
        or (typ = 'checkbox' and val <> 'true'::jsonb)
        or (typ = 'line_items' and (pg_catalog.jsonb_typeof(val) <> 'array' or pg_catalog.jsonb_array_length(val) = 0)))
    then
      raise exception 'Missing required form field' using errcode = '23514';
    end if;

    if typ = 'line_items' and val is not null and val <> 'null'::jsonb then
      if pg_catalog.jsonb_typeof(val) <> 'array' or pg_catalog.jsonb_array_length(val) > 200 then
        raise exception 'Invalid invoice line items' using errcode = '23514';
      end if;
      for item in select value from pg_catalog.jsonb_array_elements(val)
      loop
        if pg_catalog.jsonb_typeof(item) <> 'object'
            or (item->>'qty') !~ '^[0-9]+([.][0-9]+)?$'
            or (item->>'price_cents') !~ '^[0-9]+$' then
          raise exception 'Invalid invoice line item' using errcode = '23514';
        end if;
        item_qty := (item->>'qty')::numeric;
        item_price := (item->>'price_cents')::numeric;
        if item_qty > 100000 or item_price > 1000000000 then
          raise exception 'Invoice line item exceeds bounds' using errcode = '23514';
        end if;
        computed_total := computed_total + item_qty * item_price;
      end loop;
    end if;
  end loop;
  if computed_total > 9000000000000000 then
    raise exception 'Invoice total exceeds bounds' using errcode = '23514';
  end if;

  new.signer_name := nullif(pg_catalog.btrim(new.signer_name), '');
  new.signer_email := pg_catalog.lower(nullif(pg_catalog.btrim(new.signer_email), ''));
  if needs_signature and (new.signer_name is null or new.signer_email is null) then
    raise exception 'Signature required' using errcode = '23514';
  end if;
  if new.signer_email is not null
     and new.signer_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Valid signer email required' using errcode = '23514';
  end if;
  new.total_cents := computed_total::bigint;
  new.submitted_at := pg_catalog.clock_timestamp();
  new.updated_at := new.submitted_at;
  signed_iso := pg_catalog.to_char(new.submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  new.signature_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(new.values::text || '::' || coalesce(new.signer_email, '') || '::' || signed_iso, 'UTF8')), 'hex');
  new.signer_ip := null;
  return new;
end;
$function$


DROP TRIGGER IF EXISTS guard_client_form_submission ON public.form_submissions;

CREATE TRIGGER guard_client_form_submission BEFORE UPDATE ON public.form_submissions FOR EACH ROW EXECUTE FUNCTION private.guard_client_form_submission();

REVOKE ALL ON FUNCTION private.guard_client_contract_signature() FROM public, anon;

REVOKE ALL ON FUNCTION private.guard_client_form_submission() FROM public, anon;

