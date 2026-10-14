-- Fillable Forms: form_templates (admin-built) + form_submissions (client-filled).
--
-- A form template is a named set of fields (JSONB) in one of three
-- categories: contract, document, invoice. Invoice templates use the
-- `line_items` field type for billable rows with auto-totals.
--
-- Flow mirrors contracts: admin sends a form to a project (creates a
-- pending submission), client fills + signs it in the portal. The
-- submission records values, signer, timestamp, IP, and a SHA-256 hash
-- of (values + signer + timestamp) — same tamper-evident pattern as
-- contract signatures.

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null default '',
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category in ('contract', 'document', 'invoice'))
);

create index if not exists form_templates_category_idx on public.form_templates(category);
create index if not exists form_templates_active_idx on public.form_templates(active);

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.form_templates(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending',
  values jsonb not null default '{}'::jsonb,
  total_cents bigint,
  submitted_at timestamptz,
  signer_name text,
  signer_email text,
  signature_hash text,
  signer_ip text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('pending', 'submitted'))
);

create index if not exists form_submissions_project_idx on public.form_submissions(project_id);
create index if not exists form_submissions_template_idx on public.form_submissions(template_id);

alter table public.form_templates enable row level security;
alter table public.form_submissions enable row level security;

-- Templates are admin-only.
drop policy if exists "Admins manage form templates" on public.form_templates;
create policy "Admins manage form templates" on public.form_templates
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Admins manage submissions.
drop policy if exists "Admins manage form submissions" on public.form_submissions;
create policy "Admins manage form submissions" on public.form_submissions
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Clients read submissions on their own projects.
drop policy if exists "Clients read own form submissions" on public.form_submissions;
create policy "Clients read own form submissions" on public.form_submissions
  for select to authenticated
  using ((select private.can_access_project(project_id)));

-- Clients read templates that were sent to their own projects (to render the form).
drop policy if exists "Clients read sent form templates" on public.form_templates;
create policy "Clients read sent form templates" on public.form_templates
  for select to authenticated
  using (
    active = true
    and exists (
      select 1 from public.form_submissions s
      where s.template_id = form_templates.id
        and (select private.can_access_project(s.project_id))
    )
  );
drop policy if exists "Clients submit own forms" on public.form_submissions;
create policy "Clients submit own forms" on public.form_submissions
  for update to authenticated
  using (
    status = 'pending'
    and (select private.can_access_project(project_id))
  )
  with check (
    status = 'submitted'
    and (select private.can_access_project(project_id))
  );
