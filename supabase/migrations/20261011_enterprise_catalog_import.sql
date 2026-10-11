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
        nullif(v_upc, ''),
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
