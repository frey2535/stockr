-- Incremental production apply after supabase/schema.sql.
-- If this raises that stockr_users is missing, you are on the wrong
-- Supabase project, or the Stockr schema was never applied. Run
-- supabase/schema.sql first on the Stockr project (NEXT_PUBLIC_SUPABASE_URL).
-- Do not run this on NECalcul8r or The Truth.

do $$
begin
  if to_regclass('public.stockr_users') is null then
    raise exception using message =
      'stockr_users is missing. Open the Stockr Supabase project (the URL in NEXT_PUBLIC_SUPABASE_URL) and run supabase/schema.sql first. This file is only the follow-up.';
  end if;
end $$;

alter table stockr_materials add column if not exists mpn text;
alter table stockr_materials add column if not exists upc text;
alter table stockr_materials add column if not exists supplier_number text;

create table if not exists stockr_password_resets (
  id text primary key,
  user_id text not null references stockr_users (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table stockr_password_resets enable row level security;

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
    'stockr_tools',
    'stockr_password_resets',
    'stockr_storage_zones',
    'stockr_storage_bins',
    'stockr_inventory_reservations',
    'stockr_material_requests',
    'stockr_material_request_lines',
    'stockr_cycle_count_sessions',
    'stockr_cycle_count_lines'
  ]
  loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;
    execute format('alter table %I enable row level security', tbl);
    execute format('drop policy if exists stockr_deny_anon on %I', tbl);
    execute format(
      'create policy stockr_deny_anon on %I for all to anon, authenticated using (false) with check (false)',
      tbl
    );
  end loop;
end $$;
