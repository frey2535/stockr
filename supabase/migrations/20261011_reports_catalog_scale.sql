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
