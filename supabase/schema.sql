-- Stockr tables for Stockr's own Supabase project.
-- Do not run NECalcul8r or The Truth SQL here. This file never uses public.profiles.

create table if not exists stockr_users (
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists stockr_companies (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null,
  plan_status text not null,
  logo_url text not null default '/logo.png',
  primary_color text not null default '#12203a',
  accent_color text not null default '#f97316',
  buildr_linked boolean not null default false,
  buildr_company_id text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists stockr_memberships (
  user_id text not null references stockr_users (id) on delete cascade,
  company_id text not null references stockr_companies (id) on delete cascade,
  role text not null,
  primary key (user_id, company_id)
);

create table if not exists stockr_sessions (
  id text primary key,
  user_id text not null references stockr_users (id) on delete cascade,
  company_id text not null references stockr_companies (id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists stockr_locations (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  name text not null,
  type text not null,
  description text,
  assigned_to text
);

create table if not exists stockr_materials (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  name text not null,
  description text,
  category text,
  sub_category text,
  manufacturer text,
  supplier text,
  unit text not null,
  unit_cost numeric,
  barcode text,
  reorder_point numeric,
  min_stock_level numeric,
  image_url text,
  aliases jsonb not null default '[]'::jsonb
);

create table if not exists stockr_inventory (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  material_id text not null references stockr_materials (id) on delete cascade,
  location_id text not null references stockr_locations (id) on delete cascade,
  quantity numeric not null default 0,
  unique (company_id, material_id, location_id)
);

create table if not exists stockr_transactions (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  type text not null,
  material_id text not null,
  quantity numeric not null,
  from_location_id text,
  to_location_id text,
  project text,
  notes text,
  created_at timestamptz not null,
  created_by text not null
);

create table if not exists stockr_purchase_orders (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  po_number text not null,
  supplier text not null,
  expected_delivery text,
  status text not null,
  created_at timestamptz not null
);

create table if not exists stockr_purchase_order_lines (
  id bigint generated always as identity primary key,
  purchase_order_id text not null references stockr_purchase_orders (id) on delete cascade,
  company_id text not null references stockr_companies (id) on delete cascade,
  material_id text not null,
  expected_quantity numeric not null,
  received_quantity numeric not null default 0,
  unit_cost numeric
);

create table if not exists stockr_access_codes (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  code text not null,
  type text not null,
  label text not null,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null
);

create table if not exists stockr_projects (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  name text not null,
  project_number text,
  status text not null
);

create index if not exists stockr_memberships_company_idx on stockr_memberships (company_id);
create index if not exists stockr_sessions_expires_idx on stockr_sessions (expires_at);
create index if not exists stockr_locations_company_idx on stockr_locations (company_id);
create index if not exists stockr_materials_company_idx on stockr_materials (company_id);
create index if not exists stockr_materials_barcode_idx on stockr_materials (company_id, barcode);
create index if not exists stockr_inventory_company_idx on stockr_inventory (company_id);
create index if not exists stockr_transactions_company_idx on stockr_transactions (company_id, created_at desc);
create index if not exists stockr_pos_company_idx on stockr_purchase_orders (company_id);
create unique index if not exists stockr_access_codes_code_idx on stockr_access_codes (lower(code));
create index if not exists stockr_projects_company_idx on stockr_projects (company_id);

alter table stockr_users enable row level security;
alter table stockr_companies enable row level security;
alter table stockr_memberships enable row level security;
alter table stockr_sessions enable row level security;
alter table stockr_locations enable row level security;
alter table stockr_materials enable row level security;
alter table stockr_inventory enable row level security;
alter table stockr_transactions enable row level security;
alter table stockr_purchase_orders enable row level security;
alter table stockr_purchase_order_lines enable row level security;
alter table stockr_access_codes enable row level security;
alter table stockr_projects enable row level security;

-- No anon/authenticated policies. The Next.js server uses the service role, which bypasses RLS.

create or replace function stockr_replace_company_state(p_company_id text, p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update stockr_companies
  set
    name = coalesce(p_state->'settings'->>'company_name', name),
    logo_url = coalesce(p_state->'settings'->>'logo_url', logo_url),
    primary_color = coalesce(p_state->'settings'->>'primary_color', primary_color),
    accent_color = coalesce(p_state->'settings'->>'accent_color', accent_color),
    buildr_linked = coalesce((p_state->'settings'->>'buildr_linked')::boolean, buildr_linked),
    buildr_company_id = coalesce(p_state->'settings'->>'buildr_company_id', buildr_company_id)
  where id = p_company_id;

  delete from stockr_inventory where company_id = p_company_id;
  delete from stockr_purchase_order_lines where company_id = p_company_id;
  delete from stockr_purchase_orders where company_id = p_company_id;
  delete from stockr_transactions where company_id = p_company_id;
  delete from stockr_access_codes where company_id = p_company_id;
  delete from stockr_projects where company_id = p_company_id;
  delete from stockr_materials where company_id = p_company_id;
  delete from stockr_locations where company_id = p_company_id;

  insert into stockr_locations (id, company_id, name, type, description, assigned_to)
  select
    elem->>'id',
    p_company_id,
    coalesce(nullif(elem->>'name', ''), 'Untitled'),
    coalesce(nullif(elem->>'type', ''), 'warehouse'),
    elem->>'description',
    elem->>'assigned_to'
  from jsonb_array_elements(coalesce(p_state->'locations', '[]'::jsonb)) elem;

  insert into stockr_materials (
    id, company_id, name, description, category, sub_category, manufacturer, supplier,
    unit, unit_cost, barcode, reorder_point, min_stock_level, image_url, aliases
  )
  select
    elem->>'id',
    p_company_id,
    coalesce(nullif(elem->>'name', ''), 'Untitled material'),
    elem->>'description',
    elem->>'category',
    elem->>'sub_category',
    elem->>'manufacturer',
    elem->>'supplier',
    coalesce(nullif(elem->>'unit', ''), 'each'),
    nullif(elem->>'unit_cost', '')::numeric,
    elem->>'barcode',
    nullif(elem->>'reorder_point', '')::numeric,
    nullif(elem->>'min_stock_level', '')::numeric,
    elem->>'image_url',
    coalesce(elem->'aliases', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_state->'materials', '[]'::jsonb)) elem;

  insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
  select
    elem->>'id',
    p_company_id,
    elem->>'material_id',
    elem->>'location_id',
    coalesce(nullif(elem->>'quantity', '')::numeric, 0)
  from jsonb_array_elements(coalesce(p_state->'inventory', '[]'::jsonb)) elem;

  insert into stockr_transactions (
    id, company_id, type, material_id, quantity, from_location_id, to_location_id,
    project, notes, created_at, created_by
  )
  select
    elem->>'id',
    p_company_id,
    elem->>'type',
    elem->>'material_id',
    coalesce(nullif(elem->>'quantity', '')::numeric, 0),
    elem->>'from_location_id',
    elem->>'to_location_id',
    elem->>'project',
    elem->>'notes',
    coalesce((elem->>'created_at')::timestamptz, now()),
    coalesce(elem->>'created_by', 'system')
  from jsonb_array_elements(coalesce(p_state->'transactions', '[]'::jsonb)) elem;

  insert into stockr_purchase_orders (
    id, company_id, po_number, supplier, expected_delivery, status, created_at
  )
  select
    elem->>'id',
    p_company_id,
    coalesce(elem->>'po_number', ''),
    coalesce(elem->>'supplier', ''),
    elem->>'expected_delivery',
    coalesce(elem->>'status', 'draft'),
    coalesce((elem->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_state->'purchaseOrders', '[]'::jsonb)) elem;

  insert into stockr_purchase_order_lines (
    purchase_order_id, company_id, material_id, expected_quantity, received_quantity, unit_cost
  )
  select
    po->>'id',
    p_company_id,
    line->>'material_id',
    coalesce(nullif(line->>'expected_quantity', '')::numeric, 0),
    coalesce(nullif(line->>'received_quantity', '')::numeric, 0),
    nullif(line->>'unit_cost', '')::numeric
  from jsonb_array_elements(coalesce(p_state->'purchaseOrders', '[]'::jsonb)) po
  cross join lateral jsonb_array_elements(coalesce(po->'lines', '[]'::jsonb)) line;

  insert into stockr_access_codes (
    id, company_id, code, type, label, expires_at, is_active, created_at
  )
  select
    elem->>'id',
    p_company_id,
    elem->>'code',
    elem->>'type',
    coalesce(elem->>'label', ''),
    nullif(elem->>'expires_at', '')::timestamptz,
    coalesce((elem->>'is_active')::boolean, true),
    coalesce((elem->>'created_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_state->'accessCodes', '[]'::jsonb)) elem;

  insert into stockr_projects (id, company_id, name, project_number, status)
  select
    elem->>'id',
    p_company_id,
    coalesce(elem->>'name', 'Project'),
    elem->>'project_number',
    coalesce(elem->>'status', 'active')
  from jsonb_array_elements(coalesce(p_state->'projects', '[]'::jsonb)) elem;
end;
$$;

revoke all on function stockr_replace_company_state(text, jsonb) from public;
grant execute on function stockr_replace_company_state(text, jsonb) to service_role;
