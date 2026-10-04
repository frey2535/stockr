-- Stockr production runtime persistence migration
-- Safe to run more than once in the Stockr Supabase SQL Editor.

alter table stockr_materials add column if not exists mpn text;
alter table stockr_materials add column if not exists upc text;
alter table stockr_materials add column if not exists supplier_number text;

create unique index if not exists stockr_inventory_company_material_location_idx
  on stockr_inventory (company_id, material_id, location_id);

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
  target_location text;
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
    if p_from_location_id = p_to_location_id then
      raise exception 'Pick two different locations.';
    end if;

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
    target_location := coalesce(p_to_location_id, p_from_location_id);
    if target_location is null then raise exception 'Location required.'; end if;

    if p_quantity = 0 then
      delete from stockr_inventory
        where company_id = p_company_id
          and material_id = p_material_id
          and location_id = target_location;
    else
      insert into stockr_inventory (id, company_id, material_id, location_id, quantity)
      values (
        'inv_' || p_company_id || '_' || p_material_id || '_' || target_location,
        p_company_id, p_material_id, target_location, p_quantity
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
  )
  on conflict (id) do nothing;
end;
$$;

revoke all on function stockr_apply_inventory_action(
  text, text, text, text, numeric, text, text, text, text, text
) from public;

grant execute on function stockr_apply_inventory_action(
  text, text, text, text, numeric, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
