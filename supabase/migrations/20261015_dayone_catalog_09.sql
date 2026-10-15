-- Day One Electric tenant-only electrical catalog continuation batch 9
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. Unverified generic catalog; no supplier/manufacturer/MPN/pricing asserted.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00483	Miscellaneous	HVAC Electrical	HVAC Electrical - whip	whip	EA
STK-E-00484	Miscellaneous	HVAC Electrical	HVAC Electrical - disconnect	disconnect	EA
$catalog$, E'\n'))
), parsed as (
  select string_to_array(line, E'\t') as f from raw where nullif(trim(line), '') is not null
), source as (
  select 'dayone_' || lower(replace(f[1], '-', '_')) as id, 'co_dayoneelectric'::text as company_id,
    f[4] as name, concat_ws(' | ', nullif('Variant: ' || f[5], 'Variant: '), 'Generic taxonomy entry - verify manufacturer SKU', 'Verification: Unverified') as description,
    f[2] as category, f[3] as sub_category,
    case upper(f[6]) when 'EA' then 'each' when 'FT' then 'ft' when 'STICK' then 'stick' else lower(f[6]) end as unit,
    to_jsonb(array_remove(array[f[1], nullif(f[5], '')], null)) as aliases
  from parsed
)
insert into stockr_materials (id, company_id, name, description, category, sub_category, manufacturer, supplier, unit, unit_cost, barcode, mpn, upc, supplier_number, reorder_point, min_stock_level, image_url, aliases)
select id, company_id, name, description, category, sub_category, '', '', unit, null, '', '', '', '', null, null, '', aliases from source
on conflict (id) do update set
  name=excluded.name, description=excluded.description, category=excluded.category, sub_category=excluded.sub_category,
  manufacturer='', supplier='', unit=excluded.unit, unit_cost=null, barcode='', mpn='', upc='', supplier_number='',
  reorder_point=null, min_stock_level=null, image_url='', aliases=excluded.aliases
where stockr_materials.company_id='co_dayoneelectric';

notify pgrst, 'reload schema';
