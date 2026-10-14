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
