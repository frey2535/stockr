-- Day One Electric tenant-only electrical catalog continuation batch 8
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. Unverified generic catalog; no supplier/manufacturer/MPN/pricing asserted.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00423	Connectors & Terminations	Heat Shrink	Heat Shrink - standard	standard	EA
STK-E-00424	Connectors & Terminations	Cable Glands	Cable Glands - nylon	nylon	EA
STK-E-00425	Connectors & Terminations	Cable Glands	Cable Glands - metallic	metallic	EA
STK-E-00426	Low Voltage & Security	Data Jacks	Data Jacks - CAT6	CAT6	EA
STK-E-00427	Low Voltage & Security	Data Jacks	Data Jacks - CAT6A	CAT6A	EA
STK-E-00428	Low Voltage & Security	Patch Panels	Patch Panels - 24 port	24 port	EA
STK-E-00429	Low Voltage & Security	Patch Panels	Patch Panels - 48 port	48 port	EA
STK-E-00430	Low Voltage & Security	Data Faceplates	Data Faceplates - 1 port	1 port	EA
STK-E-00431	Low Voltage & Security	Data Faceplates	Data Faceplates - 2 port	2 port	EA
STK-E-00432	Low Voltage & Security	Data Faceplates	Data Faceplates - 4 port	4 port	EA
STK-E-00433	Low Voltage & Security	PoE Equipment	PoE Equipment - injector	injector	EA
STK-E-00434	Low Voltage & Security	PoE Equipment	PoE Equipment - switch	switch	EA
STK-E-00435	Low Voltage & Security	Security Cameras	Security Cameras - dome	dome	EA
STK-E-00436	Low Voltage & Security	Security Cameras	Security Cameras - bullet	bullet	EA
STK-E-00437	Low Voltage & Security	Access Control	Access Control - reader	reader	EA
STK-E-00438	Low Voltage & Security	Access Control	Access Control - electric strike	electric strike	EA
STK-E-00439	Low Voltage & Security	Fire Alarm Devices	Fire Alarm Devices - pull station	pull station	EA
STK-E-00440	Low Voltage & Security	Fire Alarm Devices	Fire Alarm Devices - horn strobe	horn strobe	EA
STK-E-00441	Low Voltage & Security	Fire Alarm Devices	Fire Alarm Devices - smoke detector	smoke detector	EA
STK-E-00442	Low Voltage & Security	Fiber Accessories	Fiber Accessories - LC connector	LC connector	EA
STK-E-00443	Low Voltage & Security	Fiber Accessories	Fiber Accessories - patch panel	patch panel	EA
STK-E-00444	Tools & Testing	Hand Tools	Hand Tools - pliers	pliers	EA
STK-E-00445	Tools & Testing	Hand Tools	Hand Tools - strippers	strippers	EA
STK-E-00446	Tools & Testing	Hand Tools	Hand Tools - screwdrivers	screwdrivers	EA
STK-E-00447	Tools & Testing	Power Tools	Power Tools - drill	drill	EA
STK-E-00448	Tools & Testing	Power Tools	Power Tools - impact driver	impact driver	EA
STK-E-00449	Tools & Testing	Power Tools	Power Tools - band saw	band saw	EA
STK-E-00450	Tools & Testing	Conduit Bending	Conduit Bending - hand bender	hand bender	EA
STK-E-00451	Tools & Testing	Conduit Bending	Conduit Bending - mechanical bender	mechanical bender	EA
STK-E-00452	Tools & Testing	Fish / Pulling	Fish / Pulling - fish tape	fish tape	EA
STK-E-00453	Tools & Testing	Fish / Pulling	Fish / Pulling - pull rope	pull rope	EA
STK-E-00454	Tools & Testing	Fish / Pulling	Fish / Pulling - lubricant	lubricant	EA
STK-E-00455	Tools & Testing	Meters	Meters - multimeter	multimeter	EA
STK-E-00456	Tools & Testing	Meters	Meters - clamp meter	clamp meter	EA
STK-E-00457	Tools & Testing	Meters	Meters - insulation tester	insulation tester	EA
STK-E-00458	Tools & Testing	Testers	Testers - receptacle tester	receptacle tester	EA
STK-E-00459	Tools & Testing	Testers	Testers - voltage detector	voltage detector	EA
STK-E-00460	Tools & Testing	Hole Making	Hole Making - hole saw	hole saw	EA
STK-E-00461	Tools & Testing	Hole Making	Hole Making - knockout punch	knockout punch	EA
STK-E-00462	Tools & Testing	PPE	PPE - gloves	gloves	EA
STK-E-00463	Tools & Testing	PPE	PPE - safety glasses	safety glasses	EA
STK-E-00464	Tools & Testing	PPE	PPE - hard hat	hard hat	EA
STK-E-00465	Miscellaneous	Electrical Tape	Electrical Tape - vinyl	vinyl	EA
STK-E-00466	Miscellaneous	Electrical Tape	Electrical Tape - rubber	rubber	EA
STK-E-00467	Miscellaneous	Sealants / Compounds	Sealants / Compounds - duct seal	duct seal	EA
STK-E-00468	Miscellaneous	Sealants / Compounds	Sealants / Compounds - firestop	firestop	EA
STK-E-00469	Miscellaneous	Sealants / Compounds	Sealants / Compounds - PVC cement	PVC cement	EA
STK-E-00470	Miscellaneous	Labels / Marking	Labels / Marking - wire marker	wire marker	EA
STK-E-00471	Miscellaneous	Labels / Marking	Labels / Marking - panel label	panel label	EA
STK-E-00472	Miscellaneous	Batteries	Batteries - alkaline	alkaline	EA
STK-E-00473	Miscellaneous	Batteries	Batteries - rechargeable	rechargeable	EA
STK-E-00474	Miscellaneous	Temporary Power	Temporary Power - spider box	spider box	EA
STK-E-00475	Miscellaneous	Temporary Power	Temporary Power - extension cord	extension cord	EA
STK-E-00476	Miscellaneous	Consumables	Consumables - rags	rags	EA
STK-E-00477	Miscellaneous	Consumables	Consumables - blades	blades	EA
STK-E-00478	Miscellaneous	Consumables	Consumables - bits	bits	EA
STK-E-00479	Miscellaneous	EV Charging	EV Charging - Level 2 charger	Level 2 charger	EA
STK-E-00480	Miscellaneous	EV Charging	EV Charging - pedestal	pedestal	EA
STK-E-00481	Miscellaneous	Generators	Generators - portable	portable	EA
STK-E-00482	Miscellaneous	Generators	Generators - standby	standby	EA
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
