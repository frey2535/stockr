-- Quote-only / procurement extras for material requests.
-- Safe to run more than once. Does not seed any tenant catalog.

alter table stockr_material_requests add column if not exists request_type text not null default 'PROCUREMENT';
alter table stockr_material_requests add column if not exists purchasing_authorized boolean not null default false;
alter table stockr_material_requests add column if not exists authorization_id text;
alter table stockr_material_requests add column if not exists authorization_by text;
alter table stockr_material_requests add column if not exists converted_from_id text;
alter table stockr_material_requests add column if not exists event_id text;
alter table stockr_material_requests add column if not exists buildr_request_id text;
alter table stockr_material_requests add column if not exists contract_version text not null default '1.1';

create unique index if not exists stockr_material_requests_event_idx
  on stockr_material_requests (company_id, event_id)
  where event_id is not null and event_id <> '';

create table if not exists stockr_price_observations (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  request_id text not null,
  line_id text not null,
  material_id text not null,
  supplier_id text,
  supplier_name text not null default '',
  product_url text,
  source_reference text,
  observed_at timestamptz not null default now(),
  mpn text,
  upc text,
  supplier_sku text,
  unit text,
  pack_qty numeric,
  currency text,
  unit_price numeric,
  availability text,
  price_status text not null default 'unavailable',
  note text
);

create table if not exists stockr_rfq_jobs (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  request_id text not null,
  supplier_id text not null,
  supplier_name text not null default '',
  status text not null default 'queued_for_official_rfq',
  channel text not null default 'buildr_official',
  created_at timestamptz not null default now(),
  note text
);

create index if not exists stockr_price_observations_request_idx
  on stockr_price_observations (company_id, request_id);
create unique index if not exists stockr_rfq_jobs_once_idx
  on stockr_rfq_jobs (company_id, request_id, supplier_id);

alter table stockr_price_observations enable row level security;
alter table stockr_rfq_jobs enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['stockr_price_observations', 'stockr_rfq_jobs']
  loop
    execute format('drop policy if exists stockr_deny_anon on %I', tbl);
    execute format(
      'create policy stockr_deny_anon on %I for all to anon, authenticated using (false) with check (false)',
      tbl
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
