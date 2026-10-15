-- Day One Electric tenant-only electrical catalog continuation batch 6
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. Unverified generic catalog; no supplier/manufacturer/MPN/pricing asserted.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00303	Distribution & Protection	Load Centers	Load Centers - 200A	200A	EA
STK-E-00304	Distribution & Protection	Panelboards	Panelboards - main lug	main lug	EA
STK-E-00305	Distribution & Protection	Panelboards	Panelboards - main breaker	main breaker	EA
STK-E-00306	Distribution & Protection	Circuit Breakers	Circuit Breakers - 1 pole 15A	1 pole 15A	EA
STK-E-00307	Distribution & Protection	Circuit Breakers	Circuit Breakers - 1 pole 20A	1 pole 20A	EA
STK-E-00308	Distribution & Protection	Circuit Breakers	Circuit Breakers - 2 pole 20A	2 pole 20A	EA
STK-E-00309	Distribution & Protection	Circuit Breakers	Circuit Breakers - 2 pole 30A	2 pole 30A	EA
STK-E-00310	Distribution & Protection	Circuit Breakers	Circuit Breakers - 2 pole 50A	2 pole 50A	EA
STK-E-00311	Distribution & Protection	Circuit Breakers	Circuit Breakers - GFCI 20A	GFCI 20A	EA
STK-E-00312	Distribution & Protection	Circuit Breakers	Circuit Breakers - AFCI 20A	AFCI 20A	EA
STK-E-00313	Distribution & Protection	Disconnect Switches	Disconnect Switches - 30A non-fused	30A non-fused	EA
STK-E-00314	Distribution & Protection	Disconnect Switches	Disconnect Switches - 60A non-fused	60A non-fused	EA
STK-E-00315	Distribution & Protection	Disconnect Switches	Disconnect Switches - 60A fused	60A fused	EA
STK-E-00316	Distribution & Protection	Disconnect Switches	Disconnect Switches - 100A fused	100A fused	EA
STK-E-00317	Distribution & Protection	Safety Switches	Safety Switches - heavy duty fused	heavy duty fused	EA
STK-E-00318	Distribution & Protection	Safety Switches	Safety Switches - heavy duty non-fused	heavy duty non-fused	EA
STK-E-00319	Distribution & Protection	Fuses	Fuses - Class RK1	Class RK1	EA
STK-E-00320	Distribution & Protection	Fuses	Fuses - Class J	Class J	EA
STK-E-00321	Distribution & Protection	Fuses	Fuses - Class CC	Class CC	EA
STK-E-00322	Distribution & Protection	Surge Protection	Surge Protection - Type 1	Type 1	EA
STK-E-00323	Distribution & Protection	Surge Protection	Surge Protection - Type 2	Type 2	EA
STK-E-00324	Distribution & Protection	Meter Sockets	Meter Sockets - 100A	100A	EA
STK-E-00325	Distribution & Protection	Meter Sockets	Meter Sockets - 200A	200A	EA
STK-E-00326	Distribution & Protection	Meter Sockets	Meter Sockets - 320A	320A	EA
STK-E-00327	Distribution & Protection	Transfer Switches	Transfer Switches - manual	manual	EA
STK-E-00328	Distribution & Protection	Transfer Switches	Transfer Switches - automatic	automatic	EA
STK-E-00329	Distribution & Protection	Transformers	Transformers - dry type	dry type	EA
STK-E-00330	Distribution & Protection	Transformers	Transformers - control	control	EA
STK-E-00331	Distribution & Protection	Contactors / Starters	Contactors / Starters - 2 pole	2 pole	EA
STK-E-00332	Distribution & Protection	Contactors / Starters	Contactors / Starters - 3 pole	3 pole	EA
STK-E-00333	Distribution & Protection	Relays / Timers	Relays / Timers - plug-in	plug-in	EA
STK-E-00334	Distribution & Protection	Relays / Timers	Relays / Timers - DIN rail	DIN rail	EA
STK-E-00335	Lighting	LED Troffers	LED Troffers - 2x2	2x2	EA
STK-E-00336	Lighting	LED Troffers	LED Troffers - 2x4	2x4	EA
STK-E-00337	Lighting	LED Panels	LED Panels - 2x2	2x2	EA
STK-E-00338	Lighting	LED Panels	LED Panels - 2x4	2x4	EA
STK-E-00339	Lighting	Strip Lights	Strip Lights - 4 ft	4 ft	EA
STK-E-00340	Lighting	Strip Lights	Strip Lights - 8 ft	8 ft	EA
STK-E-00341	Lighting	Wraparound	Wraparound - 4 ft	4 ft	EA
STK-E-00342	Lighting	High Bay	High Bay - linear	linear	EA
STK-E-00343	Lighting	High Bay	High Bay - round	round	EA
STK-E-00344	Lighting	Flood / Area	Flood / Area - flood	flood	EA
STK-E-00345	Lighting	Flood / Area	Flood / Area - area	area	EA
STK-E-00346	Lighting	Wall Packs	Wall Packs - full cutoff	full cutoff	EA
STK-E-00347	Lighting	Wall Packs	Wall Packs - traditional	traditional	EA
STK-E-00348	Lighting	Canopy	Canopy - surface	surface	EA
STK-E-00349	Lighting	Canopy	Canopy - recessed	recessed	EA
STK-E-00350	Lighting	Downlights	Downlights - 4 inch	4 inch	EA
STK-E-00351	Lighting	Downlights	Downlights - 6 inch	6 inch	EA
STK-E-00352	Lighting	Exit / Emergency	Exit / Emergency - exit sign	exit sign	EA
STK-E-00353	Lighting	Exit / Emergency	Exit / Emergency - emergency heads	emergency heads	EA
STK-E-00354	Lighting	Exit / Emergency	Exit / Emergency - combo	combo	EA
STK-E-00355	Lighting	LED Lamps	LED Lamps - A19	A19	EA
STK-E-00356	Lighting	LED Lamps	LED Lamps - BR30	BR30	EA
STK-E-00357	Lighting	LED Lamps	LED Lamps - PAR38	PAR38	EA
STK-E-00358	Lighting	LED Lamps	LED Lamps - T8	T8	EA
STK-E-00359	Lighting	Lighting Controls	Lighting Controls - photocell	photocell	EA
STK-E-00360	Lighting	Lighting Controls	Lighting Controls - timeclock	timeclock	EA
STK-E-00361	Lighting	Lighting Controls	Lighting Controls - 0-10V controller	0-10V controller	EA
STK-E-00362	Grounding & Bonding	Ground Rods	Ground Rods - 5/8 x 8 ft	5/8 x 8 ft	EA
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
