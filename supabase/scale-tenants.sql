-- Incremental apply for row-level inventory, shared rate limits, and Play expiry.
-- Safe to re-run on the Stockr project after schema.sql.

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
