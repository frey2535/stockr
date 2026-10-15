-- Day One Electric tenant-only electrical catalog continuation batch 7
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. Unverified generic catalog; no supplier/manufacturer/MPN/pricing asserted.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00363	Grounding & Bonding	Ground Rods	Ground Rods - 3/4 x 10 ft	3/4 x 10 ft	EA
STK-E-00364	Grounding & Bonding	Ground Clamps	Ground Clamps - acorn	acorn	EA
STK-E-00365	Grounding & Bonding	Ground Clamps	Ground Clamps - water pipe	water pipe	EA
STK-E-00366	Grounding & Bonding	Ground Bars	Ground Bars - isolated	isolated	EA
STK-E-00367	Grounding & Bonding	Ground Bars	Ground Bars - bonded	bonded	EA
STK-E-00368	Grounding & Bonding	Grounding Lugs	Grounding Lugs - mechanical	mechanical	EA
STK-E-00369	Grounding & Bonding	Grounding Lugs	Grounding Lugs - compression	compression	EA
STK-E-00370	Grounding & Bonding	Bonding Jumpers	Bonding Jumpers - braided	braided	EA
STK-E-00371	Grounding & Bonding	Bonding Jumpers	Bonding Jumpers - wire	wire	EA
STK-E-00372	Grounding & Bonding	Exothermic Weld	Exothermic Weld - molds	molds	EA
STK-E-00373	Grounding & Bonding	Exothermic Weld	Exothermic Weld - shots	shots	EA
STK-E-00374	Grounding & Bonding	Grounding Connectors	Grounding Connectors - split bolt	split bolt	EA
STK-E-00375	Grounding & Bonding	Grounding Connectors	Grounding Connectors - irreversible splice	irreversible splice	EA
STK-E-00376	Supports & Fasteners	Strut Channel	Strut Channel - 1-5/8 solid	1-5/8 solid	EA
STK-E-00377	Supports & Fasteners	Strut Channel	Strut Channel - 1-5/8 slotted	1-5/8 slotted	EA
STK-E-00378	Supports & Fasteners	Strut Channel	Strut Channel - 13/16 shallow	13/16 shallow	EA
STK-E-00379	Supports & Fasteners	Strut Fittings	Strut Fittings - spring nut	spring nut	EA
STK-E-00380	Supports & Fasteners	Strut Fittings	Strut Fittings - angle bracket	angle bracket	EA
STK-E-00381	Supports & Fasteners	Strut Fittings	Strut Fittings - plate	plate	EA
STK-E-00382	Supports & Fasteners	Conduit Straps	Conduit Straps - 1-hole EMT	1-hole EMT	EA
STK-E-00383	Supports & Fasteners	Conduit Straps	Conduit Straps - 2-hole EMT	2-hole EMT	EA
STK-E-00384	Supports & Fasteners	Conduit Straps	Conduit Straps - rigid	rigid	EA
STK-E-00385	Supports & Fasteners	Beam Clamps	Beam Clamps - standard	standard	EA
STK-E-00386	Supports & Fasteners	Beam Clamps	Beam Clamps - hammer-on	hammer-on	EA
STK-E-00387	Supports & Fasteners	Threaded Rod	Threaded Rod - 1/4	1/4	EA
STK-E-00388	Supports & Fasteners	Threaded Rod	Threaded Rod - 3/8	3/8	EA
STK-E-00389	Supports & Fasteners	Threaded Rod	Threaded Rod - 1/2	1/2	EA
STK-E-00390	Supports & Fasteners	Anchors	Anchors - wedge	wedge	EA
STK-E-00391	Supports & Fasteners	Anchors	Anchors - drop-in	drop-in	EA
STK-E-00392	Supports & Fasteners	Anchors	Anchors - concrete screw	concrete screw	EA
STK-E-00393	Supports & Fasteners	Screws / Nuts / Washers	Screws / Nuts / Washers - self tapping	self tapping	EA
STK-E-00394	Supports & Fasteners	Screws / Nuts / Washers	Screws / Nuts / Washers - hex nut	hex nut	EA
STK-E-00395	Supports & Fasteners	Screws / Nuts / Washers	Screws / Nuts / Washers - flat washer	flat washer	EA
STK-E-00396	Supports & Fasteners	Cable Ties	Cable Ties - 8 inch	8 inch	EA
STK-E-00397	Supports & Fasteners	Cable Ties	Cable Ties - 11 inch	11 inch	EA
STK-E-00398	Supports & Fasteners	Cable Ties	Cable Ties - 14 inch	14 inch	EA
STK-E-00399	Supports & Fasteners	Cable Tray	Cable Tray - ladder	ladder	EA
STK-E-00400	Supports & Fasteners	Cable Tray	Cable Tray - wire mesh	wire mesh	EA
STK-E-00401	Supports & Fasteners	J-Hooks	J-Hooks - 1 inch	1 inch	EA
STK-E-00402	Supports & Fasteners	J-Hooks	J-Hooks - 2 inch	2 inch	EA
STK-E-00403	Supports & Fasteners	Hangers	Hangers - trapeze	trapeze	EA
STK-E-00404	Supports & Fasteners	Hangers	Hangers - clevis	clevis	EA
STK-E-00405	Connectors & Terminations	Wire Nuts	Wire Nuts - small	small	EA
STK-E-00406	Connectors & Terminations	Wire Nuts	Wire Nuts - medium	medium	EA
STK-E-00407	Connectors & Terminations	Wire Nuts	Wire Nuts - large	large	EA
STK-E-00408	Connectors & Terminations	Lever Connectors	Lever Connectors - 2 port	2 port	EA
STK-E-00409	Connectors & Terminations	Lever Connectors	Lever Connectors - 3 port	3 port	EA
STK-E-00410	Connectors & Terminations	Lever Connectors	Lever Connectors - 5 port	5 port	EA
STK-E-00411	Connectors & Terminations	Mechanical Lugs	Mechanical Lugs - single conductor	single conductor	EA
STK-E-00412	Connectors & Terminations	Mechanical Lugs	Mechanical Lugs - multi tap	multi tap	EA
STK-E-00413	Connectors & Terminations	Compression Lugs	Compression Lugs - 1 hole	1 hole	EA
STK-E-00414	Connectors & Terminations	Compression Lugs	Compression Lugs - 2 hole	2 hole	EA
STK-E-00415	Connectors & Terminations	Split Bolts	Split Bolts - copper	copper	EA
STK-E-00416	Connectors & Terminations	Split Bolts	Split Bolts - dual rated	dual rated	EA
STK-E-00417	Connectors & Terminations	Insulated Multi-Taps	Insulated Multi-Taps - 2 port	2 port	EA
STK-E-00418	Connectors & Terminations	Insulated Multi-Taps	Insulated Multi-Taps - 3 port	3 port	EA
STK-E-00419	Connectors & Terminations	Insulated Multi-Taps	Insulated Multi-Taps - 4 port	4 port	EA
STK-E-00420	Connectors & Terminations	Terminal Blocks	Terminal Blocks - DIN rail	DIN rail	EA
STK-E-00421	Connectors & Terminations	Terminal Blocks	Terminal Blocks - barrier	barrier	EA
STK-E-00422	Connectors & Terminations	Heat Shrink	Heat Shrink - adhesive lined	adhesive lined	EA
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
