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
  assigned_location_id text not null,
  assigned_to text,
  status text not null default 'available'
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
  if p_company_id is null or p_material_id is null or p_quantity is null or p_quantity <= 0 then
    raise exception 'Invalid inventory action.';
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
