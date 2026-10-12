begin;

select plan(11);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.clients'::regclass), 'clients has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.client_memberships'::regclass), 'client_memberships has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.leads'::regclass), 'leads has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.projects'::regclass), 'projects has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'tasks has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.activities'::regclass), 'activities has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.opportunities'::regclass), 'opportunities has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.templates'::regclass), 'templates has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.files'::regclass), 'files has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.approvals'::regclass), 'approvals has RLS enabled');

select * from finish();
rollback;
