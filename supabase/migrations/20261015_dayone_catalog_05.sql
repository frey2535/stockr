-- Day One Electric tenant-only electrical catalog continuation batch 5
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. Unverified generic catalog; no supplier/manufacturer/MPN/pricing asserted.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00243	Cable	SOOW / Portable Cord	SOOW / Portable Cord - 8/4	8/4	FT
STK-E-00244	Cable	SOOW / Portable Cord	SOOW / Portable Cord - 6/4	6/4	FT
STK-E-00245	Cable	SJTW / SJOW	SJTW / SJOW - 16/3	16/3	FT
STK-E-00246	Cable	SJTW / SJOW	SJTW / SJOW - 14/3	14/3	FT
STK-E-00247	Cable	SJTW / SJOW	SJTW / SJOW - 12/3	12/3	FT
STK-E-00248	Cable	Fire Alarm	Fire Alarm - 18/2	18/2	FT
STK-E-00249	Cable	Fire Alarm	Fire Alarm - 16/2	16/2	FT
STK-E-00250	Cable	Fire Alarm	Fire Alarm - 14/2	14/2	FT
STK-E-00251	Cable	Security / Control	Security / Control - 22/2	22/2	FT
STK-E-00252	Cable	Security / Control	Security / Control - 22/4	22/4	FT
STK-E-00253	Cable	Security / Control	Security / Control - 18/4	18/4	FT
STK-E-00254	Cable	Thermostat	Thermostat - 18/2	18/2	FT
STK-E-00255	Cable	Thermostat	Thermostat - 18/5	18/5	FT
STK-E-00256	Cable	Thermostat	Thermostat - 18/8	18/8	FT
STK-E-00257	Cable	CAT6 / CAT6A	CAT6 / CAT6A - CAT6 riser	CAT6 riser	FT
STK-E-00258	Cable	CAT6 / CAT6A	CAT6 / CAT6A - CAT6 plenum	CAT6 plenum	FT
STK-E-00259	Cable	CAT6 / CAT6A	CAT6 / CAT6A - CAT6A riser	CAT6A riser	FT
STK-E-00260	Cable	Fiber Optic	Fiber Optic - singlemode	singlemode	FT
STK-E-00261	Cable	Fiber Optic	Fiber Optic - multimode	multimode	FT
STK-E-00262	Cable	Coaxial	Coaxial - RG6	RG6	FT
STK-E-00263	Cable	Coaxial	Coaxial - RG11	RG11	FT
STK-E-00264	Cable	Landscape Lighting	Landscape Lighting - 12/2	12/2	FT
STK-E-00265	Cable	Landscape Lighting	Landscape Lighting - 10/2	10/2	FT
STK-E-00266	Devices	Duplex Receptacles	Duplex Receptacles - 15A standard	15A standard	EA
STK-E-00267	Devices	Duplex Receptacles	Duplex Receptacles - 20A specification	20A specification	EA
STK-E-00268	Devices	Duplex Receptacles	Duplex Receptacles - 20A hospital grade	20A hospital grade	EA
STK-E-00269	Devices	GFCI Receptacles	GFCI Receptacles - 15A	15A	EA
STK-E-00270	Devices	GFCI Receptacles	GFCI Receptacles - 20A	20A	EA
STK-E-00271	Devices	AFCI Receptacles	AFCI Receptacles - 15A	15A	EA
STK-E-00272	Devices	AFCI Receptacles	AFCI Receptacles - 20A	20A	EA
STK-E-00273	Devices	USB Receptacles	USB Receptacles - 15A USB-A/C	15A USB-A/C	EA
STK-E-00274	Devices	USB Receptacles	USB Receptacles - 20A USB-C	20A USB-C	EA
STK-E-00275	Devices	Single Receptacles	Single Receptacles - 20A	20A	EA
STK-E-00276	Devices	Single Receptacles	Single Receptacles - 30A	30A	EA
STK-E-00277	Devices	Single Receptacles	Single Receptacles - 50A	50A	EA
STK-E-00278	Devices	Locking Receptacles	Locking Receptacles - L5-20R	L5-20R	EA
STK-E-00279	Devices	Locking Receptacles	Locking Receptacles - L6-20R	L6-20R	EA
STK-E-00280	Devices	Locking Receptacles	Locking Receptacles - L14-30R	L14-30R	EA
STK-E-00281	Devices	Switches - Toggle	Switches - Toggle - single pole	single pole	EA
STK-E-00282	Devices	Switches - Toggle	Switches - Toggle - 3-way	3-way	EA
STK-E-00283	Devices	Switches - Toggle	Switches - Toggle - 4-way	4-way	EA
STK-E-00284	Devices	Switches - Decorator	Switches - Decorator - single pole	single pole	EA
STK-E-00285	Devices	Switches - Decorator	Switches - Decorator - 3-way	3-way	EA
STK-E-00286	Devices	Switches - Decorator	Switches - Decorator - 4-way	4-way	EA
STK-E-00287	Devices	Dimmers	Dimmers - LED compatible	LED compatible	EA
STK-E-00288	Devices	Dimmers	Dimmers - 0-10V	0-10V	EA
STK-E-00289	Devices	Occupancy / Vacancy Sensors	Occupancy / Vacancy Sensors - wall switch	wall switch	EA
STK-E-00290	Devices	Occupancy / Vacancy Sensors	Occupancy / Vacancy Sensors - ceiling mount	ceiling mount	EA
STK-E-00291	Devices	Plugs / Connectors	Plugs / Connectors - 15A straight blade	15A straight blade	EA
STK-E-00292	Devices	Plugs / Connectors	Plugs / Connectors - 20A straight blade	20A straight blade	EA
STK-E-00293	Devices	Plugs / Connectors	Plugs / Connectors - 30A locking	30A locking	EA
STK-E-00294	Devices	Wallplates	Wallplates - 1 gang toggle	1 gang toggle	EA
STK-E-00295	Devices	Wallplates	Wallplates - 1 gang decorator	1 gang decorator	EA
STK-E-00296	Devices	Wallplates	Wallplates - 2 gang decorator	2 gang decorator	EA
STK-E-00297	Devices	Wallplates	Wallplates - duplex	duplex	EA
STK-E-00298	Devices	Weatherproof Covers	Weatherproof Covers - in-use single gang	in-use single gang	EA
STK-E-00299	Devices	Weatherproof Covers	Weatherproof Covers - in-use double gang	in-use double gang	EA
STK-E-00300	Devices	Weatherproof Covers	Weatherproof Covers - flip cover	flip cover	EA
STK-E-00301	Distribution & Protection	Load Centers	Load Centers - 100A	100A	EA
STK-E-00302	Distribution & Protection	Load Centers	Load Centers - 125A	125A	EA
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
