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
  primary_color text not null default '#2563eb',
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
  mpn text,
  upc text,
  supplier_number text,
  reorder_point numeric,
  min_stock_level numeric,
  image_url text,
  aliases jsonb not null default '[]'::jsonb
);

alter table stockr_materials add column if not exists mpn text;
alter table stockr_materials add column if not exists upc text;
alter table stockr_materials add column if not exists supplier_number text;

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

create table if not exists stockr_tools (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  name text not null,
  description text,
  category text,
  barcode text,
  tool_number text not null default '',
  assigned_location_id text not null,
  assigned_to text,
  status text not null default 'available',
  condition text not null default 'good'
);
alter table stockr_tools add column if not exists tool_number text not null default '';
alter table stockr_tools add column if not exists condition text not null default 'good';

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
create index if not exists stockr_tools_company_idx on stockr_tools (company_id);

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
alter table stockr_tools enable row level security;

-- Service role (Next.js) bypasses RLS. Deny browser/anon keys even if leaked.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'stockr_users',
    'stockr_companies',
    'stockr_memberships',
    'stockr_sessions',
    'stockr_locations',
    'stockr_materials',
    'stockr_inventory',
    'stockr_transactions',
    'stockr_purchase_orders',
    'stockr_purchase_order_lines',
    'stockr_access_codes',
    'stockr_projects',
    'stockr_tools'
  ]
  loop
    execute format('drop policy if exists stockr_deny_anon on %I', tbl);
    execute format(
      'create policy stockr_deny_anon on %I for all to anon, authenticated using (false) with check (false)',
      tbl
    );
  end loop;
end $$;

create table if not exists stockr_password_resets (
  id text primary key,
  user_id text not null references stockr_users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table stockr_password_resets enable row level security;
drop policy if exists stockr_deny_anon on stockr_password_resets;
create policy stockr_deny_anon on stockr_password_resets for all to anon, authenticated using (false) with check (false);

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
  delete from stockr_tools where company_id = p_company_id;
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

  insert into stockr_tools (
    id, company_id, name, description, category, barcode, assigned_location_id, assigned_to, status
  )
  select
    elem->>'id',
    p_company_id,
    coalesce(nullif(elem->>'name', ''), 'Untitled tool'),
    elem->>'description',
    elem->>'category',
    elem->>'barcode',
    coalesce(elem->>'assigned_location_id', ''),
    elem->>'assigned_to',
    coalesce(elem->>'status', 'available')
  from jsonb_array_elements(coalesce(p_state->'tools', '[]'::jsonb)) elem;
end;
$$;

revoke all on function stockr_replace_company_state(text, jsonb) from public;
grant execute on function stockr_replace_company_state(text, jsonb) to service_role;


-- Elite field operations
create table if not exists stockr_storage_zones (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  location_id text not null references stockr_locations (id) on delete cascade,
  name text not null,
  code text,
  sort_order integer not null default 0
);

create table if not exists stockr_storage_bins (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  location_id text not null references stockr_locations (id) on delete cascade,
  zone_id text references stockr_storage_zones (id) on delete set null,
  name text not null,
  code text not null,
  barcode text,
  description text,
  is_active boolean not null default true
);

create table if not exists stockr_inventory_reservations (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  material_id text not null references stockr_materials (id) on delete cascade,
  location_id text not null references stockr_locations (id) on delete cascade,
  project_id text,
  quantity numeric not null check (quantity > 0),
  status text not null default 'active',
  notes text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists stockr_material_requests (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  project_id text,
  destination_location_id text,
  requested_by text not null,
  priority text not null default 'normal',
  status text not null default 'requested',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists stockr_material_request_lines (
  id text primary key,
  request_id text not null references stockr_material_requests (id) on delete cascade,
  company_id text not null references stockr_companies (id) on delete cascade,
  material_id text not null references stockr_materials (id) on delete cascade,
  quantity_requested numeric not null check (quantity_requested > 0),
  quantity_fulfilled numeric not null default 0
);

create table if not exists stockr_cycle_count_sessions (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  location_id text not null references stockr_locations (id) on delete cascade,
  zone_id text,
  bin_id text,
  status text not null default 'open',
  created_by text not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists stockr_cycle_count_lines (
  id text primary key,
  session_id text not null references stockr_cycle_count_sessions (id) on delete cascade,
  company_id text not null references stockr_companies (id) on delete cascade,
  material_id text not null references stockr_materials (id) on delete cascade,
  expected_quantity numeric not null default 0,
  counted_quantity numeric
);

create index if not exists stockr_storage_zones_company_idx on stockr_storage_zones (company_id, location_id);
create unique index if not exists stockr_storage_bins_code_idx on stockr_storage_bins (company_id, location_id, lower(code));
create index if not exists stockr_reservations_lookup_idx on stockr_inventory_reservations (company_id, material_id, location_id, status);
create index if not exists stockr_material_requests_company_idx on stockr_material_requests (company_id, created_at desc);
create index if not exists stockr_cycle_counts_company_idx on stockr_cycle_count_sessions (company_id, created_at desc);

alter table stockr_storage_zones enable row level security;
alter table stockr_storage_bins enable row level security;
alter table stockr_inventory_reservations enable row level security;
alter table stockr_material_requests enable row level security;
alter table stockr_material_request_lines enable row level security;
alter table stockr_cycle_count_sessions enable row level security;
alter table stockr_cycle_count_lines enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'stockr_storage_zones',
    'stockr_storage_bins',
    'stockr_inventory_reservations',
    'stockr_material_requests',
    'stockr_material_request_lines',
    'stockr_cycle_count_sessions',
    'stockr_cycle_count_lines'
  ]
  loop
    execute format('drop policy if exists stockr_deny_anon on %I', tbl);
    execute format(
      'create policy stockr_deny_anon on %I for all to anon, authenticated using (false) with check (false)',
      tbl
    );
  end loop;
end $$;

-- Scale helpers (also supabase/scale-tenants.sql)
alter table stockr_companies add column if not exists play_product_id text;
alter table stockr_companies add column if not exists play_purchase_token text;
alter table stockr_companies add column if not exists play_expires_at timestamptz;

alter table stockr_password_resets add column if not exists token_lookup text;
create unique index if not exists stockr_password_resets_lookup_idx
  on stockr_password_resets (token_lookup)
  where token_lookup is not null;

create table if not exists stockr_rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at timestamptz not null
);

alter table stockr_rate_limits enable row level security;
drop policy if exists stockr_deny_anon on stockr_rate_limits;
create policy stockr_deny_anon on stockr_rate_limits for all to anon, authenticated using (false) with check (false);

create or replace function stockr_rate_hit(p_key text, p_limit integer, p_window_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  row_count integer;
  row_reset timestamptz;
begin
  insert into stockr_rate_limits (key, count, reset_at)
  values (p_key, 1, now_ts + (p_window_ms || ' milliseconds')::interval)
  on conflict (key) do update
    set count = case
      when stockr_rate_limits.reset_at <= now_ts then 1
      else stockr_rate_limits.count + 1
    end,
    reset_at = case
      when stockr_rate_limits.reset_at <= now_ts
        then now_ts + (p_window_ms || ' milliseconds')::interval
      else stockr_rate_limits.reset_at
    end
  returning count, reset_at into row_count, row_reset;

  if row_count > p_limit then
    return jsonb_build_object('ok', false, 'remaining', 0);
  end if;
  return jsonb_build_object('ok', true, 'remaining', greatest(p_limit - row_count, 0));
end;
$$;

revoke all on function stockr_rate_hit(text, integer, integer) from public;
grant execute on function stockr_rate_hit(text, integer, integer) to service_role;

create or replace function stockr_bump_inventory(
  p_company_id text,
  p_material_id text,
  p_location_id text,
  p_delta numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  next_qty numeric;
begin
  if p_company_id is null or p_material_id is null or p_location_id is null then
    raise exception 'Inventory bump needs company, material, and location.';
  end if;
  if not exists (select 1 from stockr_companies where id = p_company_id) then
    raise exception 'Unknown company.';
  end if;

  update stockr_inventory
  set quantity = quantity + p_delta
  where company_id = p_company_id and material_id = p_material_id and location_id = p_location_id
  returning quantity into next_qty;

  if not found then
    if p_delta < 0 then
      raise exception 'Not enough quantity on hand.';
    end if;
    insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
    values (
      'inv_' || p_company_id || '_' || p_material_id || '_' || p_location_id,
      p_company_id,
      p_material_id,
      p_location_id,
      p_delta
    )
    returning quantity into next_qty;
  end if;

  if next_qty < 0 then
    raise exception 'Not enough quantity on hand.';
  end if;
  if next_qty = 0 then
    delete from stockr_inventory
    where company_id = p_company_id and material_id = p_material_id and location_id = p_location_id;
  end if;
  return next_qty;
end;
$$;

revoke all on function stockr_bump_inventory(text, text, text, numeric) from public;
grant execute on function stockr_bump_inventory(text, text, text, numeric) to service_role;

create or replace function stockr_set_inventory(
  p_company_id text,
  p_material_id text,
  p_location_id text,
  p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity <= 0 then
    delete from stockr_inventory
    where company_id = p_company_id and material_id = p_material_id and location_id = p_location_id;
    return;
  end if;
  insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
  values (
    'inv_' || p_company_id || '_' || p_material_id || '_' || p_location_id,
    p_company_id,
    p_material_id,
    p_location_id,
    p_quantity
  )
  on conflict (company_id, material_id, location_id) do update
    set quantity = excluded.quantity;
end;
$$;

revoke all on function stockr_set_inventory(text, text, text, numeric) from public;
grant execute on function stockr_set_inventory(text, text, text, numeric) to service_role;

-- Hot-path indexes for many company workspaces. Safe to re-run.

create index if not exists stockr_inventory_company_material_idx
  on stockr_inventory (company_id, material_id);
create index if not exists stockr_inventory_company_location_idx
  on stockr_inventory (company_id, location_id);
create index if not exists stockr_transactions_company_created_idx
  on stockr_transactions (company_id, created_at desc);
create index if not exists stockr_materials_company_name_idx
  on stockr_materials (company_id, name);
create index if not exists stockr_materials_company_barcode_idx
  on stockr_materials (company_id, barcode);
create index if not exists stockr_sessions_expires_idx
  on stockr_sessions (expires_at);
create index if not exists stockr_memberships_user_idx
  on stockr_memberships (user_id);
create index if not exists stockr_purchase_orders_company_created_idx
  on stockr_purchase_orders (company_id, created_at desc);


-- Production hardening: perform each inventory mutation and its audit record atomically.
create or replace function stockr_apply_inventory_action(
  p_company_id text,
  p_tx_id text,
  p_type text,
  p_material_id text,
  p_quantity numeric,
  p_from_location_id text,
  p_to_location_id text,
  p_project text,
  p_notes text,
  p_created_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if p_company_id is null or p_material_id is null or p_quantity is null or p_quantity < 0 then
    raise exception 'Invalid inventory action.';
  end if;
  if p_quantity = 0 and p_type not in ('adjust', 'count') then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if not exists (
    select 1 from stockr_materials
    where id = p_material_id and company_id = p_company_id
  ) then
    raise exception 'Material does not belong to this company.';
  end if;

  if p_from_location_id is not null and not exists (
    select 1 from stockr_locations
    where id = p_from_location_id and company_id = p_company_id
  ) then
    raise exception 'Source location does not belong to this company.';
  end if;

  if p_to_location_id is not null and not exists (
    select 1 from stockr_locations
    where id = p_to_location_id and company_id = p_company_id
  ) then
    raise exception 'Destination location does not belong to this company.';
  end if;

  if p_type in ('add', 'receive', 'return') then
    if p_to_location_id is null then raise exception 'Destination location required.'; end if;
    insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
    values (
      'inv_' || p_company_id || '_' || p_material_id || '_' || p_to_location_id,
      p_company_id, p_material_id, p_to_location_id, p_quantity
    )
    on conflict (company_id, material_id, location_id) do update
      set quantity = stockr_inventory.quantity + excluded.quantity;

  elsif p_type in ('use', 'shrink') then
    if p_from_location_id is null then raise exception 'Source location required.'; end if;
    update stockr_inventory
      set quantity = quantity - p_quantity
      where company_id = p_company_id
        and material_id = p_material_id
        and location_id = p_from_location_id
        and quantity >= p_quantity;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Not enough quantity on hand.'; end if;
    delete from stockr_inventory
      where company_id = p_company_id
        and material_id = p_material_id
        and location_id = p_from_location_id
        and quantity = 0;

  elsif p_type = 'transfer' then
    if p_from_location_id is null or p_to_location_id is null then
      raise exception 'Both source and destination required.';
    end if;
    if p_from_location_id = p_to_location_id then raise exception 'Pick two different locations.'; end if;

    update stockr_inventory
      set quantity = quantity - p_quantity
      where company_id = p_company_id
        and material_id = p_material_id
        and location_id = p_from_location_id
        and quantity >= p_quantity;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Not enough quantity on hand.'; end if;

    insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
    values (
      'inv_' || p_company_id || '_' || p_material_id || '_' || p_to_location_id,
      p_company_id, p_material_id, p_to_location_id, p_quantity
    )
    on conflict (company_id, material_id, location_id) do update
      set quantity = stockr_inventory.quantity + excluded.quantity;

    delete from stockr_inventory
      where company_id = p_company_id
        and material_id = p_material_id
        and location_id = p_from_location_id
        and quantity = 0;

  elsif p_type in ('adjust', 'count') then
    if coalesce(p_to_location_id, p_from_location_id) is null then
      raise exception 'Location required.';
    end if;
    if p_quantity = 0 then
      delete from stockr_inventory
        where company_id = p_company_id
          and material_id = p_material_id
          and location_id = coalesce(p_to_location_id, p_from_location_id);
    else
      insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
      values (
        'inv_' || p_company_id || '_' || p_material_id || '_' || coalesce(p_to_location_id, p_from_location_id),
        p_company_id, p_material_id, coalesce(p_to_location_id, p_from_location_id), p_quantity
      )
      on conflict (company_id, material_id, location_id) do update
        set quantity = excluded.quantity;
    end if;
  else
    raise exception 'Unknown inventory action.';
  end if;

  insert into stockr_transactions (
    id, company_id, type, material_id, quantity,
    from_location_id, to_location_id, project, notes, created_at, created_by
  ) values (
    p_tx_id, p_company_id, p_type, p_material_id, p_quantity,
    p_from_location_id, p_to_location_id, nullif(p_project, ''), coalesce(p_notes, ''),
    clock_timestamp(), p_created_by
  );
end;
$$;

revoke all on function stockr_apply_inventory_action(
  text, text, text, text, numeric, text, text, text, text, text
) from public;
grant execute on function stockr_apply_inventory_action(
  text, text, text, text, numeric, text, text, text, text, text
) to service_role;


-- Production hardening: receive a PO atomically (lines + inventory + activity + PO status).
create or replace function stockr_receive_purchase_order(
  p_company_id text,
  p_po_id text,
  p_location_id text,
  p_receipts jsonb,
  p_created_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt jsonb;
  v_material_id text;
  requested_qty numeric;
  receive_qty numeric;
  expected_qty numeric;
  received_qty numeric;
  tx_id text;
begin
  if not exists (
    select 1 from stockr_purchase_orders
    where id = p_po_id and company_id = p_company_id
  ) then
    raise exception 'Purchase order not found in this company.';
  end if;

  if not exists (
    select 1 from stockr_locations
    where id = p_location_id and company_id = p_company_id
  ) then
    raise exception 'Receiving location does not belong to this company.';
  end if;

  for receipt in
    select value from jsonb_array_elements(coalesce(p_receipts, '[]'::jsonb))
  loop
    v_material_id := receipt->>'material_id';
    requested_qty := coalesce(nullif(receipt->>'quantity', '')::numeric, 0);
    tx_id := coalesce(nullif(receipt->>'tx_id', ''), 'tx_' || md5(random()::text || clock_timestamp()::text));

    if requested_qty <= 0 then
      continue;
    end if;

    select expected_quantity, received_quantity
      into expected_qty, received_qty
    from stockr_purchase_order_lines
    where purchase_order_id = p_po_id
      and company_id = p_company_id
      and material_id = v_material_id
    for update;

    if not found then
      raise exception 'Purchase order line not found in this company.';
    end if;

    receive_qty := least(requested_qty, greatest(expected_qty - received_qty, 0));
    if receive_qty <= 0 then
      continue;
    end if;

    update stockr_purchase_order_lines
      set received_quantity = received_quantity + receive_qty
      where purchase_order_id = p_po_id
        and company_id = p_company_id
        and material_id = v_material_id;

    insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
    values (
      'inv_' || p_company_id || '_' || v_material_id || '_' || p_location_id,
      p_company_id, v_material_id, p_location_id, receive_qty
    )
    on conflict (company_id, material_id, location_id) do update
      set quantity = stockr_inventory.quantity + excluded.quantity;

    insert into stockr_transactions (
      id, company_id, type, material_id, quantity,
      from_location_id, to_location_id, project, notes, created_at, created_by
    ) values (
      tx_id, p_company_id, 'receive', v_material_id, receive_qty,
      null, p_location_id, null, p_po_id, clock_timestamp(), p_created_by
    );
  end loop;

  update stockr_purchase_orders
  set status = case
    when not exists (
      select 1 from stockr_purchase_order_lines
      where purchase_order_id = p_po_id
        and company_id = p_company_id
        and received_quantity < expected_quantity
    ) then 'received'
    when exists (
      select 1 from stockr_purchase_order_lines
      where purchase_order_id = p_po_id
        and company_id = p_company_id
        and received_quantity > 0
    ) then 'partial'
    else status
  end
  where id = p_po_id and company_id = p_company_id;
end;
$$;

revoke all on function stockr_receive_purchase_order(text, text, text, jsonb, text) from public;
grant execute on function stockr_receive_purchase_order(text, text, text, jsonb, text) to service_role;


-- Atomic, replay-safe inventory operations.
-- Safe to run more than once.

create table if not exists stockr_operation_keys (
  company_id text not null references stockr_companies (id) on delete cascade,
  operation_key text not null,
  operation_type text not null,
  created_at timestamptz not null default now(),
  primary key (company_id, operation_key)
);

alter table stockr_operation_keys enable row level security;
drop policy if exists stockr_deny_anon on stockr_operation_keys;
create policy stockr_deny_anon on stockr_operation_keys
  for all to anon, authenticated using (false) with check (false);

create index if not exists stockr_operation_keys_created_idx
  on stockr_operation_keys (company_id, created_at desc);

create or replace function stockr_apply_inventory_action_once(
  p_company_id text,
  p_operation_key text,
  p_tx_id text,
  p_type text,
  p_material_id text,
  p_quantity numeric,
  p_from_location_id text,
  p_to_location_id text,
  p_project text,
  p_notes text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Operation key required.';
  end if;

  insert into stockr_operation_keys (company_id, operation_key, operation_type)
  values (p_company_id, p_operation_key, 'inventory_action')
  on conflict (company_id, operation_key) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  perform stockr_apply_inventory_action(
    p_company_id,
    p_tx_id,
    p_type,
    p_material_id,
    p_quantity,
    p_from_location_id,
    p_to_location_id,
    p_project,
    p_notes,
    p_created_by
  );

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function stockr_apply_inventory_action_once(
  text, text, text, text, text, numeric, text, text, text, text, text
) from public;
grant execute on function stockr_apply_inventory_action_once(
  text, text, text, text, text, numeric, text, text, text, text, text
) to service_role;

create or replace function stockr_apply_inventory_batch_once(
  p_company_id text,
  p_operation_key text,
  p_actions jsonb,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
  action_row jsonb;
  line_number integer := 0;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Operation key required.';
  end if;
  if p_actions is null or jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) = 0 then
    raise exception 'At least one inventory action is required.';
  end if;

  insert into stockr_operation_keys (company_id, operation_key, operation_type)
  values (p_company_id, p_operation_key, 'inventory_batch')
  on conflict (company_id, operation_key) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  for action_row in select value from jsonb_array_elements(p_actions)
  loop
    line_number := line_number + 1;
    begin
      perform stockr_apply_inventory_action(
        p_company_id,
        action_row->>'tx_id',
        action_row->>'type',
        action_row->>'material_id',
        coalesce(nullif(action_row->>'quantity', '')::numeric, 0),
        nullif(action_row->>'from_location_id', ''),
        nullif(action_row->>'to_location_id', ''),
        coalesce(action_row->>'project', ''),
        coalesce(action_row->>'notes', ''),
        p_created_by
      );
    exception
      when others then
        raise exception 'Line %: %', line_number, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function stockr_apply_inventory_batch_once(text, text, jsonb, text) from public;
grant execute on function stockr_apply_inventory_batch_once(text, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';


-- Atomic reservation allocation and submit-once cycle counts.
-- Safe to run more than once.

create or replace function stockr_create_inventory_reservation(
  p_company_id text,
  p_reservation_id text,
  p_material_id text,
  p_location_id text,
  p_project_id text,
  p_quantity numeric,
  p_notes text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  on_hand numeric := 0;
  reserved numeric := 0;
  available numeric := 0;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Reservation quantity must be greater than zero.';
  end if;

  if not exists (
    select 1 from stockr_materials
    where id = p_material_id and company_id = p_company_id
  ) then
    raise exception 'Material not found in this company workspace.';
  end if;

  if not exists (
    select 1 from stockr_locations
    where id = p_location_id and company_id = p_company_id
  ) then
    raise exception 'Location not found in this company workspace.';
  end if;

  if p_project_id is not null and not exists (
    select 1 from stockr_projects
    where id = p_project_id and company_id = p_company_id
  ) then
    raise exception 'Project not found in this company workspace.';
  end if;

  -- Lock the inventory row for this material/location so concurrent reservations serialize.
  select quantity
    into on_hand
    from stockr_inventory
    where company_id = p_company_id
      and material_id = p_material_id
      and location_id = p_location_id
    for update;

  on_hand := coalesce(on_hand, 0);

  select coalesce(sum(quantity), 0)
    into reserved
    from stockr_inventory_reservations
    where company_id = p_company_id
      and material_id = p_material_id
      and location_id = p_location_id
      and status = 'active';

  available := greatest(0, on_hand - reserved);

  if p_quantity > available then
    raise exception 'Only % are available after existing reservations.', available;
  end if;

  insert into stockr_inventory_reservations (
    id,
    company_id,
    material_id,
    location_id,
    project_id,
    quantity,
    status,
    notes,
    created_by,
    created_at
  ) values (
    p_reservation_id,
    p_company_id,
    p_material_id,
    p_location_id,
    p_project_id,
    p_quantity,
    'active',
    nullif(trim(coalesce(p_notes, '')), ''),
    p_created_by,
    clock_timestamp()
  );

  return jsonb_build_object(
    'reservation_id', p_reservation_id,
    'on_hand', on_hand,
    'reserved_before', reserved,
    'available_before', available
  );
end;
$$;

revoke all on function stockr_create_inventory_reservation(
  text, text, text, text, text, numeric, text, text
) from public;
grant execute on function stockr_create_inventory_reservation(
  text, text, text, text, text, numeric, text, text
) to service_role;

create or replace function stockr_submit_cycle_count_once(
  p_company_id text,
  p_session_id text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row stockr_cycle_count_sessions%rowtype;
  line_row stockr_cycle_count_lines%rowtype;
  tx_id text;
begin
  select *
    into session_row
    from stockr_cycle_count_sessions
    where id = p_session_id
      and company_id = p_company_id
    for update;

  if not found then
    raise exception 'Cycle count not found in this company workspace.';
  end if;

  if session_row.status = 'submitted' then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  if session_row.status <> 'open' then
    raise exception 'Cycle count is not open.';
  end if;

  for line_row in
    select *
      from stockr_cycle_count_lines
      where session_id = p_session_id
        and company_id = p_company_id
      order by id
  loop
    if line_row.counted_quantity is null then
      continue;
    end if;

    if not exists (
      select 1 from stockr_materials
      where id = line_row.material_id
        and company_id = p_company_id
    ) then
      raise exception 'Cycle count material does not belong to this company.';
    end if;

    tx_id := 'tx_count_' || md5(p_company_id || ':' || p_session_id || ':' || line_row.id);

    perform stockr_apply_inventory_action(
      p_company_id,
      tx_id,
      'count',
      line_row.material_id,
      line_row.counted_quantity,
      null,
      session_row.location_id,
      '',
      'Cycle count ' || p_session_id,
      p_created_by
    );
  end loop;

  update stockr_cycle_count_sessions
    set status = 'submitted',
        submitted_at = clock_timestamp()
    where id = p_session_id
      and company_id = p_company_id;

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function stockr_submit_cycle_count_once(text, text, text) from public;
grant execute on function stockr_submit_cycle_count_once(text, text, text) to service_role;

notify pgrst, 'reload schema';


create or replace function stockr_set_cycle_count_line(
  p_company_id text,
  p_session_id text,
  p_line_id text,
  p_material_id text,
  p_counted_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $
declare
  session_row stockr_cycle_count_sessions%rowtype;
  expected_qty numeric := 0;
begin
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'Counted quantity cannot be negative.';
  end if;

  select *
    into session_row
    from stockr_cycle_count_sessions
    where id = p_session_id
      and company_id = p_company_id
    for update;

  if not found then
    raise exception 'Cycle count not found in this company workspace.';
  end if;

  if session_row.status <> 'open' then
    raise exception 'Cycle count is already submitted.';
  end if;

  if not exists (
    select 1 from stockr_materials
    where id = p_material_id
      and company_id = p_company_id
  ) then
    raise exception 'Material not found in this company workspace.';
  end if;

  update stockr_cycle_count_lines
    set counted_quantity = p_counted_quantity
    where company_id = p_company_id
      and session_id = p_session_id
      and material_id = p_material_id;

  if found then
    return;
  end if;

  select coalesce(quantity, 0)
    into expected_qty
    from stockr_inventory
    where company_id = p_company_id
      and material_id = p_material_id
      and location_id = session_row.location_id;

  insert into stockr_cycle_count_lines (
    id,
    session_id,
    company_id,
    material_id,
    expected_quantity,
    counted_quantity
  ) values (
    p_line_id,
    p_session_id,
    p_company_id,
    p_material_id,
    coalesce(expected_qty, 0),
    p_counted_quantity
  );
end;
$;

revoke all on function stockr_set_cycle_count_line(text, text, text, text, numeric) from public;
grant execute on function stockr_set_cycle_count_line(text, text, text, text, numeric) to service_role;



-- Purchasing integrity: transaction-safe PO creation and replay-safe receiving.
-- Safe to run more than once.

create or replace function stockr_create_purchase_order(
  p_company_id text,
  p_po_id text,
  p_po_number text,
  p_supplier text,
  p_expected_delivery text,
  p_lines jsonb,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  line_row jsonb;
  v_material_id text;
  v_expected numeric;
  v_received numeric;
  v_unit_cost numeric;
begin
  if nullif(trim(p_po_number), '') is null then
    raise exception 'PO number is required.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one purchase-order line is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_company_id || ':' || lower(trim(p_po_number))));

  if exists (
    select 1
      from stockr_purchase_orders
      where company_id = p_company_id
        and lower(trim(po_number)) = lower(trim(p_po_number))
  ) then
    raise exception 'A purchase order with this PO number already exists.';
  end if;

  for line_row in select value from jsonb_array_elements(p_lines)
  loop
    v_material_id := line_row->>'material_id';
    v_expected := coalesce(nullif(line_row->>'expected_quantity', '')::numeric, 0);
    v_received := coalesce(nullif(line_row->>'received_quantity', '')::numeric, 0);
    v_unit_cost := nullif(line_row->>'unit_cost', '')::numeric;

    if not exists (
      select 1 from stockr_materials
      where id = v_material_id
        and company_id = p_company_id
    ) then
      raise exception 'Purchase-order material does not belong to this company.';
    end if;

    if v_expected <= 0 then
      raise exception 'Expected quantity must be greater than zero.';
    end if;

    if v_received < 0 or v_received > v_expected then
      raise exception 'Received quantity is invalid.';
    end if;

    if v_unit_cost is not null and v_unit_cost < 0 then
      raise exception 'Unit cost cannot be negative.';
    end if;
  end loop;

  insert into stockr_purchase_orders (
    id, company_id, po_number, supplier, expected_delivery, status, created_at
  ) values (
    p_po_id,
    p_company_id,
    trim(p_po_number),
    coalesce(p_supplier, ''),
    nullif(p_expected_delivery, ''),
    'ordered',
    coalesce(p_created_at, clock_timestamp())
  );

  insert into stockr_purchase_order_lines (
    purchase_order_id,
    company_id,
    material_id,
    expected_quantity,
    received_quantity,
    unit_cost
  )
  select
    p_po_id,
    p_company_id,
    line_row->>'material_id',
    (line_row->>'expected_quantity')::numeric,
    coalesce(nullif(line_row->>'received_quantity', '')::numeric, 0),
    nullif(line_row->>'unit_cost', '')::numeric
  from jsonb_array_elements(p_lines) line_row;
end;
$$;

revoke all on function stockr_create_purchase_order(
  text, text, text, text, text, jsonb, timestamptz
) from public;
grant execute on function stockr_create_purchase_order(
  text, text, text, text, text, jsonb, timestamptz
) to service_role;

create or replace function stockr_receive_purchase_order_once(
  p_company_id text,
  p_operation_key text,
  p_po_id text,
  p_location_id text,
  p_receipts jsonb,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Operation key required.';
  end if;

  insert into stockr_operation_keys (company_id, operation_key, operation_type)
  values (p_company_id, p_operation_key, 'purchase_order_receive')
  on conflict (company_id, operation_key) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  perform stockr_receive_purchase_order(
    p_company_id,
    p_po_id,
    p_location_id,
    p_receipts,
    p_created_by
  );

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function stockr_receive_purchase_order_once(
  text, text, text, text, jsonb, text
) from public;
grant execute on function stockr_receive_purchase_order_once(
  text, text, text, text, jsonb, text
) to service_role;

notify pgrst, 'reload schema';


-- Large-tenant dashboard aggregation.
-- Keeps dashboard totals/valuation/location summaries/alerts inside Postgres instead of
-- loading the entire company catalog and inventory ledger into the application process.

create or replace function stockr_dashboard_summary(p_company_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with inventory_totals as (
  select
    coalesce(sum(i.quantity), 0)::numeric as total_items,
    coalesce(sum(i.quantity * coalesce(m.unit_cost, 0)), 0)::numeric as total_value
  from stockr_inventory i
  join stockr_materials m
    on m.id = i.material_id
   and m.company_id = p_company_id
  where i.company_id = p_company_id
),
material_count as (
  select count(*)::integer as count
  from stockr_materials
  where company_id = p_company_id
),
location_rows as (
  select
    l.id,
    l.name,
    l.type,
    l.description,
    l.assigned_to,
    coalesce(sum(case when i.quantity > 0 then i.quantity else 0 end), 0)::numeric as units,
    count(distinct case when i.quantity > 0 then i.material_id end)::integer as material_count
  from stockr_locations l
  left join stockr_inventory i
    on i.company_id = p_company_id
   and i.location_id = l.id
  where l.company_id = p_company_id
  group by l.id, l.name, l.type, l.description, l.assigned_to
),
location_summary as (
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'type', type,
        'description', description,
        'assigned_to', assigned_to,
        'units', units,
        'materialCount', material_count
      )
      order by name
    ), '[]'::jsonb) as rows,
    count(*) filter (where type = 'vehicle')::integer as vehicles,
    count(*) filter (where type = 'warehouse')::integer as warehouses
  from location_rows
),
material_totals as (
  select
    m.id,
    m.name,
    m.description,
    m.category,
    m.sub_category,
    m.manufacturer,
    m.supplier,
    m.unit,
    m.unit_cost,
    m.barcode,
    m.mpn,
    m.upc,
    m.supplier_number,
    m.reorder_point,
    m.min_stock_level,
    m.image_url,
    m.aliases,
    coalesce(sum(i.quantity), 0)::numeric as total_qty
  from stockr_materials m
  left join stockr_inventory i
    on i.company_id = p_company_id
   and i.material_id = m.id
  where m.company_id = p_company_id
    and (m.reorder_point is not null or m.min_stock_level is not null)
  group by
    m.id, m.name, m.description, m.category, m.sub_category, m.manufacturer,
    m.supplier, m.unit, m.unit_cost, m.barcode, m.mpn, m.upc,
    m.supplier_number, m.reorder_point, m.min_stock_level, m.image_url, m.aliases
),
alert_rows as (
  select *
  from (
    select
      mt.*,
      case
        when mt.min_stock_level is not null and mt.total_qty <= mt.min_stock_level then 'critical'
        when mt.reorder_point is not null and mt.total_qty <= mt.reorder_point then 'reorder'
        else null
      end as status
    from material_totals mt
  ) ranked
  where status is not null
  order by
    case status when 'critical' then 0 else 1 end,
    name
  limit 25
),
alerts as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'description', description,
      'category', category,
      'sub_category', sub_category,
      'manufacturer', manufacturer,
      'supplier', supplier,
      'unit', unit,
      'unit_cost', unit_cost,
      'barcode', barcode,
      'mpn', mpn,
      'upc', upc,
      'supplier_number', supplier_number,
      'reorder_point', reorder_point,
      'min_stock_level', min_stock_level,
      'image_url', image_url,
      'aliases', aliases,
      'totalQty', total_qty,
      'status', status
    )
  ), '[]'::jsonb) as rows
  from alert_rows
)
select jsonb_build_object(
  'totalItems', (select total_items from inventory_totals),
  'value', (select total_value from inventory_totals),
  'materialCount', (select count from material_count),
  'vehicles', (select vehicles from location_summary),
  'warehouses', (select warehouses from location_summary),
  'locations', (select rows from location_summary),
  'alerts', (select rows from alerts)
);
$$;

revoke all on function stockr_dashboard_summary(text) from public;
grant execute on function stockr_dashboard_summary(text) to service_role;

notify pgrst, 'reload schema';


-- Large-tenant reporting and catalog facet aggregation.
-- Safe to run more than once.

create index if not exists stockr_materials_category_idx
  on stockr_materials (company_id, category);

create index if not exists stockr_materials_category_subcategory_idx
  on stockr_materials (company_id, category, sub_category);

create or replace function stockr_catalog_facets(
  p_company_id text,
  p_category text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with categories as (
  select distinct category
  from stockr_materials
  where company_id = p_company_id
    and nullif(trim(coalesce(category, '')), '') is not null
),
subcategories as (
  select distinct sub_category
  from stockr_materials
  where company_id = p_company_id
    and nullif(trim(coalesce(sub_category, '')), '') is not null
    and (
      nullif(trim(coalesce(p_category, '')), '') is null
      or category = p_category
    )
)
select jsonb_build_object(
  'categories',
  coalesce(
    (select jsonb_agg(category order by category) from categories),
    '[]'::jsonb
  ),
  'subcategories',
  coalesce(
    (select jsonb_agg(sub_category order by sub_category) from subcategories),
    '[]'::jsonb
  )
);
$$;

revoke all on function stockr_catalog_facets(text, text) from public;
grant execute on function stockr_catalog_facets(text, text) to service_role;

create or replace function stockr_reports_summary(
  p_company_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with valuation_rows as (
  select
    l.name as location,
    l.type,
    coalesce(sum(i.quantity), 0)::numeric as total_qty,
    coalesce(sum(i.quantity * coalesce(m.unit_cost, 0)), 0)::numeric as total_value
  from stockr_locations l
  left join stockr_inventory i
    on i.company_id = p_company_id
   and i.location_id = l.id
  left join stockr_materials m
    on m.company_id = p_company_id
   and m.id = i.material_id
  where l.company_id = p_company_id
  group by l.id, l.name, l.type
),
usage_rows as (
  select
    coalesce(nullif(trim(t.project), ''), 'Unassigned') as project,
    coalesce(sum(t.quantity), 0)::numeric as qty,
    coalesce(sum(t.quantity * coalesce(m.unit_cost, 0)), 0)::numeric as value
  from stockr_transactions t
  left join stockr_materials m
    on m.company_id = p_company_id
   and m.id = t.material_id
  where t.company_id = p_company_id
    and t.type = 'use'
    and t.created_at >= p_from
    and t.created_at <= p_to
  group by coalesce(nullif(trim(t.project), ''), 'Unassigned')
)
select jsonb_build_object(
  'valuation',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'location', location,
          'type', type,
          'totalQty', total_qty,
          'totalValue', total_value
        )
        order by location
      )
      from valuation_rows
    ),
    '[]'::jsonb
  ),
  'grand',
  coalesce((select sum(total_value) from valuation_rows), 0),
  'usage',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'project', project,
          'qty', qty,
          'value', value
        )
        order by value desc, project
      )
      from usage_rows
    ),
    '[]'::jsonb
  )
);
$$;

revoke all on function stockr_reports_summary(text, timestamptz, timestamptz) from public;
grant execute on function stockr_reports_summary(text, timestamptz, timestamptz) to service_role;

create index if not exists stockr_transactions_reports_idx
  on stockr_transactions (company_id, type, created_at desc);

notify pgrst, 'reload schema';


-- Enterprise catalog imports with transactional application and verified price provenance.
-- Depends on supplier-intelligence tables. Safe to run more than once.

create table if not exists stockr_catalog_imports (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  file_name text not null,
  supplier_id text references stockr_suppliers (id) on delete set null,
  status text not null default 'pending',
  row_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  priced_count integer not null default 0,
  error_message text,
  created_by text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists stockr_catalog_imports_company_idx
  on stockr_catalog_imports (company_id, created_at desc);

create index if not exists stockr_materials_upc_lookup_idx
  on stockr_materials (company_id, upc)
  where nullif(trim(coalesce(upc, '')), '') is not null;

create index if not exists stockr_materials_mpn_mfr_lookup_idx
  on stockr_materials (company_id, manufacturer, mpn)
  where nullif(trim(coalesce(mpn, '')), '') is not null;

create index if not exists stockr_materials_supplier_number_lookup_idx
  on stockr_materials (company_id, supplier, supplier_number)
  where nullif(trim(coalesce(supplier_number, '')), '') is not null;

alter table stockr_catalog_imports enable row level security;
drop policy if exists stockr_deny_anon on stockr_catalog_imports;
create policy stockr_deny_anon on stockr_catalog_imports
  for all to anon, authenticated using (false) with check (false);

create or replace function stockr_import_catalog_batch(
  p_company_id text,
  p_import_id text,
  p_supplier_id text,
  p_source_reference text,
  p_rows jsonb,
  p_max_materials integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  row_number integer := 0;
  current_materials integer := 0;
  created_count integer := 0;
  updated_count integer := 0;
  priced_count integer := 0;
  v_material_id text;
  v_matches text[];
  v_name text;
  v_unit text;
  v_category text;
  v_manufacturer text;
  v_supplier text;
  v_supplier_name text;
  v_barcode text;
  v_mpn text;
  v_upc text;
  v_supplier_number text;
  v_description text;
  v_unit_cost numeric;
  v_new_id text;
  v_aliases jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Catalog import contains no rows.';
  end if;

  if not exists (
    select 1 from stockr_catalog_imports
    where id = p_import_id and company_id = p_company_id
  ) then
    raise exception 'Catalog import record not found in this company.';
  end if;

  if p_supplier_id is not null then
    select name
      into v_supplier_name
      from stockr_suppliers
      where id = p_supplier_id
        and company_id = p_company_id
        and enabled = true
        and approved = true;
    if not found then
      raise exception 'Selected supplier is not an approved supplier for this company.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('stockr-catalog-import:' || p_company_id));

  select count(*)
    into current_materials
    from stockr_materials
    where company_id = p_company_id;

  for row_data in select value from jsonb_array_elements(p_rows)
  loop
    row_number := row_number + 1;
    v_material_id := null;
    v_matches := null;

    v_name := trim(coalesce(row_data->>'name', ''));
    v_unit := coalesce(nullif(trim(coalesce(row_data->>'unit', '')), ''), 'each');
    v_category := trim(coalesce(row_data->>'category', ''));
    v_manufacturer := trim(coalesce(row_data->>'manufacturer', ''));
    v_supplier := coalesce(v_supplier_name, trim(coalesce(row_data->>'supplier', '')));
    v_barcode := trim(coalesce(row_data->>'barcode', ''));
    v_mpn := trim(coalesce(row_data->>'mpn', ''));
    v_upc := trim(coalesce(row_data->>'upc', ''));
    v_supplier_number := trim(coalesce(row_data->>'supplier_number', ''));
    v_description := trim(coalesce(row_data->>'description', ''));
    v_new_id := nullif(trim(coalesce(row_data->>'id', '')), '');
    v_unit_cost := nullif(row_data->>'unit_cost', '')::numeric;

    if v_name = '' then
      raise exception 'Row %: material name is required.', row_number;
    end if;

    if v_unit_cost is not null then
      if v_unit_cost < 0 then
        raise exception 'Row %: unit cost cannot be negative.', row_number;
      end if;
      if p_supplier_id is null then
        raise exception 'Row %: price requires an approved supplier source.', row_number;
      end if;
    end if;

    if v_upc <> '' then
      select array_agg(id order by id) into v_matches
      from stockr_materials
      where company_id = p_company_id and upc = v_upc;
    elsif v_barcode <> '' then
      select array_agg(id order by id) into v_matches
      from stockr_materials
      where company_id = p_company_id and barcode = v_barcode;
    elsif v_mpn <> '' and v_manufacturer <> '' then
      select array_agg(id order by id) into v_matches
      from stockr_materials
      where company_id = p_company_id
        and lower(trim(manufacturer)) = lower(v_manufacturer)
        and lower(trim(mpn)) = lower(v_mpn);
    elsif v_supplier_number <> '' and v_supplier <> '' then
      select array_agg(id order by id) into v_matches
      from stockr_materials
      where company_id = p_company_id
        and lower(trim(supplier)) = lower(v_supplier)
        and lower(trim(supplier_number)) = lower(v_supplier_number);
    end if;

    if coalesce(cardinality(v_matches), 0) > 1 then
      raise exception 'Row %: identifier matches multiple catalog items; resolve duplicates before import.', row_number;
    end if;

    if coalesce(cardinality(v_matches), 0) = 1 then
      v_material_id := v_matches[1];
    end if;

    v_aliases := to_jsonb(array_remove(
      array[
        nullif(v_barcode, ''),
        nullif(v_mpn, ''),
        nullif(v_upc, ''),
        nullif(v_supplier_number, '')
      ],
      null
    ));

    if v_material_id is null then
      if v_new_id is null then
        raise exception 'Row %: import row is missing its generated material ID.', row_number;
      end if;
      if exists (select 1 from stockr_materials where id = v_new_id) then
        raise exception 'Row %: generated material ID already exists.', row_number;
      end if;
      if p_max_materials is not null
        and current_materials + created_count + 1 > p_max_materials then
        raise exception 'Catalog import exceeds the company material limit of %.', p_max_materials;
      end if;

      insert into stockr_materials (
        id, company_id, name, description, category, sub_category, manufacturer, supplier,
        unit, unit_cost, barcode, mpn, upc, supplier_number,
        reorder_point, min_stock_level, image_url, aliases
      ) values (
        v_new_id,
        p_company_id,
        v_name,
        v_description,
        v_category,
        trim(coalesce(row_data->>'sub_category', '')),
        v_manufacturer,
        v_supplier,
        v_unit,
        v_unit_cost,
        v_barcode,
        v_mpn,
        v_upc,
        v_supplier_number,
        nullif(row_data->>'reorder_point', '')::numeric,
        nullif(row_data->>'min_stock_level', '')::numeric,
        trim(coalesce(row_data->>'image_url', '')),
        coalesce(v_aliases, '[]'::jsonb)
      );
      v_material_id := v_new_id;
      created_count := created_count + 1;
    else
      update stockr_materials
      set
        name = v_name,
        description = case when v_description <> '' then v_description else description end,
        category = case when v_category <> '' then v_category else category end,
        sub_category = case
          when nullif(trim(coalesce(row_data->>'sub_category', '')), '') is not null
            then trim(row_data->>'sub_category')
          else sub_category
        end,
        manufacturer = case when v_manufacturer <> '' then v_manufacturer else manufacturer end,
        supplier = case when v_supplier <> '' then v_supplier else supplier end,
        unit = v_unit,
        unit_cost = coalesce(v_unit_cost, unit_cost),
        barcode = case when v_barcode <> '' then v_barcode else barcode end,
        mpn = case when v_mpn <> '' then v_mpn else mpn end,
        upc = case when v_upc <> '' then v_upc else upc end,
        supplier_number = case when v_supplier_number <> '' then v_supplier_number else supplier_number end,
        reorder_point = coalesce(nullif(row_data->>'reorder_point', '')::numeric, reorder_point),
        min_stock_level = coalesce(nullif(row_data->>'min_stock_level', '')::numeric, min_stock_level),
        image_url = case
          when nullif(trim(coalesce(row_data->>'image_url', '')), '') is not null
            then trim(row_data->>'image_url')
          else image_url
        end,
        aliases = coalesce(aliases, '[]'::jsonb) || coalesce(v_aliases, '[]'::jsonb)
      where id = v_material_id
        and company_id = p_company_id;
      updated_count := updated_count + 1;
    end if;

    if v_unit_cost is not null then
      insert into stockr_supplier_offers (
        id,
        company_id,
        supplier_id,
        material_id,
        product_name,
        manufacturer,
        mpn,
        upc,
        supplier_sku,
        price,
        currency,
        unit,
        product_url,
        source_type,
        source_reference,
        observed_at,
        expires_at,
        exact_match
      ) values (
        'off_' || substr(md5(random()::text || clock_timestamp()::text || row_number::text), 1, 20),
        p_company_id,
        p_supplier_id,
        v_material_id,
        v_name,
        nullif(v_manufacturer, ''),
        nullif(v_mpn, ''),
        nullif(coalesce(nullif(v_upc, ''), v_barcode), ''),
        nullif(v_supplier_number, ''),
        v_unit_cost,
        'USD',
        v_unit,
        null,
        'price_file',
        p_source_reference,
        clock_timestamp(),
        null,
        (v_mpn <> '' or v_upc <> '' or v_barcode <> '')
      );
      priced_count := priced_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', row_number,
    'created', created_count,
    'updated', updated_count,
    'priced', priced_count
  );
end;
$$;

revoke all on function stockr_import_catalog_batch(
  text, text, text, text, jsonb, integer
) from public;
grant execute on function stockr_import_catalog_batch(
  text, text, text, text, jsonb, integer
) to service_role;

notify pgrst, 'reload schema';
