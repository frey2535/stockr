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
