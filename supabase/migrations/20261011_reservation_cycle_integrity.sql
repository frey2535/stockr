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
