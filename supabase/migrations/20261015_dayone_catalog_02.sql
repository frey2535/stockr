-- Day One Electric tenant-only electrical catalog batch 2 of 4
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. All supplier/manufacturer/MPN/prices are unverified and intentionally blank.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00122	Conduit Fittings	Conduit Bodies - LB	Conduit Bodies - LB - 1/2	1/2	EA
STK-E-00123	Conduit Fittings	Conduit Bodies - LB	Conduit Bodies - LB - 3/4	3/4	EA
STK-E-00124	Conduit Fittings	Conduit Bodies - LB	Conduit Bodies - LB - 1	1	EA
STK-E-00125	Conduit Fittings	Conduit Bodies - LB	Conduit Bodies - LB - 2	2	EA
STK-E-00126	Conduit Fittings	Conduit Bodies - LL	Conduit Bodies - LL - 1/2	1/2	EA
STK-E-00127	Conduit Fittings	Conduit Bodies - LL	Conduit Bodies - LL - 3/4	3/4	EA
STK-E-00128	Conduit Fittings	Conduit Bodies - LL	Conduit Bodies - LL - 1	1	EA
STK-E-00129	Conduit Fittings	Conduit Bodies - LR	Conduit Bodies - LR - 1/2	1/2	EA
STK-E-00130	Conduit Fittings	Conduit Bodies - LR	Conduit Bodies - LR - 3/4	3/4	EA
STK-E-00131	Conduit Fittings	Conduit Bodies - LR	Conduit Bodies - LR - 1	1	EA
STK-E-00132	Conduit Fittings	Conduit Bodies - T	Conduit Bodies - T - 1/2	1/2	EA
STK-E-00133	Conduit Fittings	Conduit Bodies - T	Conduit Bodies - T - 3/4	3/4	EA
STK-E-00134	Conduit Fittings	Conduit Bodies - T	Conduit Bodies - T - 1	1	EA
STK-E-00135	Boxes	4 Square	4 Square - 1-1/2 deep	1-1/2 deep	EA
STK-E-00136	Boxes	4 Square	4 Square - 2-1/8 deep	2-1/8 deep	EA
STK-E-00137	Boxes	4-11/16 Square	4-11/16 Square - 2-1/8 deep	2-1/8 deep	EA
STK-E-00138	Boxes	Handy / Utility	Handy / Utility - 1-1/2 deep	1-1/2 deep	EA
STK-E-00139	Boxes	Handy / Utility	Handy / Utility - 2-1/8 deep	2-1/8 deep	EA
STK-E-00140	Boxes	Single Gang Device	Single Gang Device - new work	new work	EA
STK-E-00141	Boxes	Single Gang Device	Single Gang Device - old work	old work	EA
STK-E-00142	Boxes	Double Gang Device	Double Gang Device - new work	new work	EA
STK-E-00143	Boxes	Double Gang Device	Double Gang Device - old work	old work	EA
STK-E-00144	Boxes	FS / FD Cast	FS / FD Cast - single gang	single gang	EA
STK-E-00145	Boxes	FS / FD Cast	FS / FD Cast - double gang	double gang	EA
STK-E-00146	Boxes	Weatherproof Cast	Weatherproof Cast - single gang	single gang	EA
STK-E-00147	Boxes	Weatherproof Cast	Weatherproof Cast - double gang	double gang	EA
STK-E-00148	Boxes	Weatherproof Cast	Weatherproof Cast - round	round	EA
STK-E-00149	Boxes	PVC Boxes	PVC Boxes - single gang	single gang	EA
STK-E-00150	Boxes	PVC Boxes	PVC Boxes - double gang	double gang	EA
STK-E-00151	Boxes	PVC Boxes	PVC Boxes - round	round	EA
STK-E-00152	Boxes	PVC Boxes	PVC Boxes - junction	junction	EA
STK-E-00153	Boxes	Octagon / Round	Octagon / Round - 4 inch	4 inch	EA
STK-E-00154	Boxes	Octagon / Round	Octagon / Round - 3-1/2 inch	3-1/2 inch	EA
STK-E-00155	Boxes	Pull / Junction Boxes	Pull / Junction Boxes - 6x6x4	6x6x4	EA
STK-E-00156	Boxes	Pull / Junction Boxes	Pull / Junction Boxes - 8x8x4	8x8x4	EA
STK-E-00157	Boxes	Pull / Junction Boxes	Pull / Junction Boxes - 12x12x6	12x12x6	EA
STK-E-00158	Boxes	Pull / Junction Boxes	Pull / Junction Boxes - 16x16x6	16x16x6	EA
STK-E-00159	Boxes	Floor Boxes	Floor Boxes - single service	single service	EA
STK-E-00160	Boxes	Floor Boxes	Floor Boxes - multi service	multi service	EA
STK-E-00161	Boxes	Box Extensions	Box Extensions - single gang	single gang	EA
STK-E-00162	Boxes	Box Extensions	Box Extensions - double gang	double gang	EA
STK-E-00163	Boxes	Mud Rings	Mud Rings - single gang	single gang	EA
STK-E-00164	Boxes	Mud Rings	Mud Rings - double gang	double gang	EA
STK-E-00165	Boxes	Mud Rings	Mud Rings - round	round	EA
STK-E-00166	Boxes	Blank Covers	Blank Covers - 4 square	4 square	EA
STK-E-00167	Boxes	Blank Covers	Blank Covers - 4-11/16 square	4-11/16 square	EA
STK-E-00168	Boxes	Blank Covers	Blank Covers - FS/FD	FS/FD	EA
STK-E-00169	Boxes	Device Covers	Device Covers - duplex	duplex	EA
STK-E-00170	Boxes	Device Covers	Device Covers - GFCI/decorator	GFCI/decorator	EA
STK-E-00171	Boxes	Device Covers	Device Covers - toggle	toggle	EA
STK-E-00172	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 14 AWG	14 AWG	FT
STK-E-00173	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 12 AWG	12 AWG	FT
STK-E-00174	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 10 AWG	10 AWG	FT
STK-E-00175	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 8 AWG	8 AWG	FT
STK-E-00176	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 6 AWG	6 AWG	FT
STK-E-00177	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 4 AWG	4 AWG	FT
STK-E-00178	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 2 AWG	2 AWG	FT
STK-E-00179	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 1/0 AWG	1/0 AWG	FT
STK-E-00180	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 2/0 AWG	2/0 AWG	FT
STK-E-00181	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 3/0 AWG	3/0 AWG	FT
STK-E-00182	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 4/0 AWG	4/0 AWG	FT
STK-E-00183	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 250 kcmil	250 kcmil	FT
STK-E-00184	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 350 kcmil	350 kcmil	FT
STK-E-00185	Wire	THHN/THWN-2 Copper	THHN/THWN-2 Copper - 500 kcmil	500 kcmil	FT
STK-E-00186	Wire	XHHW-2 Copper	XHHW-2 Copper - 8 AWG	8 AWG	FT
STK-E-00187	Wire	XHHW-2 Copper	XHHW-2 Copper - 6 AWG	6 AWG	FT
STK-E-00188	Wire	XHHW-2 Copper	XHHW-2 Copper - 4 AWG	4 AWG	FT
STK-E-00189	Wire	XHHW-2 Copper	XHHW-2 Copper - 2 AWG	2 AWG	FT
STK-E-00190	Wire	XHHW-2 Copper	XHHW-2 Copper - 1/0 AWG	1/0 AWG	FT
STK-E-00191	Wire	XHHW-2 Copper	XHHW-2 Copper - 4/0 AWG	4/0 AWG	FT
STK-E-00192	Wire	XHHW-2 Copper	XHHW-2 Copper - 250 kcmil	250 kcmil	FT
STK-E-00193	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 6 AWG	6 AWG	FT
STK-E-00194	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 4 AWG	4 AWG	FT
STK-E-00195	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 2 AWG	2 AWG	FT
STK-E-00196	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 1/0 AWG	1/0 AWG	FT
STK-E-00197	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 2/0 AWG	2/0 AWG	FT
STK-E-00198	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 4/0 AWG	4/0 AWG	FT
STK-E-00199	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 250 kcmil	250 kcmil	FT
STK-E-00200	Wire	XHHW-2 Aluminum	XHHW-2 Aluminum - 500 kcmil	500 kcmil	FT
STK-E-00201	Wire	Bare Copper	Bare Copper - 14 AWG	14 AWG	FT
STK-E-00202	Wire	Bare Copper	Bare Copper - 12 AWG	12 AWG	FT
STK-E-00203	Wire	Bare Copper	Bare Copper - 10 AWG	10 AWG	FT
STK-E-00204	Wire	Bare Copper	Bare Copper - 8 AWG	8 AWG	FT
STK-E-00205	Wire	Bare Copper	Bare Copper - 6 AWG	6 AWG	FT
STK-E-00206	Wire	Bare Copper	Bare Copper - 4 AWG	4 AWG	FT
STK-E-00207	Wire	Bare Copper	Bare Copper - 2 AWG	2 AWG	FT
STK-E-00208	Wire	Bare Copper	Bare Copper - 1/0 AWG	1/0 AWG	FT
STK-E-00209	Wire	TFFN	TFFN - 18 AWG	18 AWG	FT
STK-E-00210	Wire	TFFN	TFFN - 16 AWG	16 AWG	FT
STK-E-00211	Wire	MTW	MTW - 14 AWG	14 AWG	FT
STK-E-00212	Wire	MTW	MTW - 12 AWG	12 AWG	FT
STK-E-00213	Wire	MTW	MTW - 10 AWG	10 AWG	FT
STK-E-00214	Wire	MTW	MTW - 8 AWG	8 AWG	FT
STK-E-00215	Cable	NM-B	NM-B - 14/2 w/G	14/2 w/G	FT
STK-E-00216	Cable	NM-B	NM-B - 14/3 w/G	14/3 w/G	FT
STK-E-00217	Cable	NM-B	NM-B - 12/2 w/G	12/2 w/G	FT
STK-E-00218	Cable	NM-B	NM-B - 12/3 w/G	12/3 w/G	FT
STK-E-00219	Cable	NM-B	NM-B - 10/2 w/G	10/2 w/G	FT
STK-E-00220	Cable	NM-B	NM-B - 10/3 w/G	10/3 w/G	FT
STK-E-00221	Cable	NM-B	NM-B - 8/3 w/G	8/3 w/G	FT
STK-E-00222	Cable	NM-B	NM-B - 6/3 w/G	6/3 w/G	FT
STK-E-00223	Cable	MC Cable	MC Cable - 14/2 w/G	14/2 w/G	FT
STK-E-00224	Cable	MC Cable	MC Cable - 12/2 w/G	12/2 w/G	FT
STK-E-00225	Cable	MC Cable	MC Cable - 12/3 w/G	12/3 w/G	FT
STK-E-00226	Cable	MC Cable	MC Cable - 10/2 w/G	10/2 w/G	FT
STK-E-00227	Cable	MC Cable	MC Cable - 10/3 w/G	10/3 w/G	FT
STK-E-00228	Cable	AC / BX Cable	AC / BX Cable - 14/2	14/2	FT
STK-E-00229	Cable	AC / BX Cable	AC / BX Cable - 12/2	12/2	FT
STK-E-00230	Cable	UF-B	UF-B - 14/2 w/G	14/2 w/G	FT
STK-E-00231	Cable	UF-B	UF-B - 12/2 w/G	12/2 w/G	FT
STK-E-00232	Cable	UF-B	UF-B - 10/2 w/G	10/2 w/G	FT
STK-E-00233	Cable	SER	SER - 6-6-6-6	6-6-6-6	FT
STK-E-00234	Cable	SER	SER - 4-4-4-6	4-4-4-6	FT
STK-E-00235	Cable	SER	SER - 2-2-2-4	2-2-2-4	FT
STK-E-00236	Cable	SEU	SEU - 2 AWG	2 AWG	FT
STK-E-00237	Cable	SEU	SEU - 1/0 AWG	1/0 AWG	FT
STK-E-00238	Cable	SEU	SEU - 2/0 AWG	2/0 AWG	FT
STK-E-00239	Cable	URD	URD - 2-2-2-4	2-2-2-4	FT
STK-E-00240	Cable	URD	URD - 4/0-4/0-4/0-2/0	4/0-4/0-4/0-2/0	FT
STK-E-00241	Cable	SOOW / Portable Cord	SOOW / Portable Cord - 12/3	12/3	FT
STK-E-00242	Cable	SOOW / Portable Cord	SOOW / Portable Cord - 10/3	10/3	FT
$catalog$, E'\n'))
), parsed as (
  select string_to_array(line, E'\t') as f
  from raw
  where nullif(trim(line), '') is not null
), source as (
  select
    'dayone_' || lower(replace(f[1], '-', '_')) as id,
    'co_dayoneelectric'::text as company_id,
    f[4] as name,
    concat_ws(' | ', nullif('Variant: ' || f[5], 'Variant: '), 'Generic taxonomy entry - verify manufacturer SKU', 'Verification: Unverified') as description,
    f[2] as category,
    f[3] as sub_category,
    case upper(f[6]) when 'EA' then 'each' when 'FT' then 'ft' when 'STICK' then 'stick' else lower(f[6]) end as unit,
    to_jsonb(array_remove(array[f[1], nullif(f[5], '')], null)) as aliases
  from parsed
)
insert into stockr_materials (
  id, company_id, name, description, category, sub_category, manufacturer, supplier,
  unit, unit_cost, barcode, mpn, upc, supplier_number, reorder_point, min_stock_level, image_url, aliases
)
select
  id, company_id, name, description, category, sub_category, '', '',
  unit, null, '', '', '', '', null, null, '', aliases
from source
on conflict (id) do update set
  name = excluded.name, description = excluded.description, category = excluded.category,
  sub_category = excluded.sub_category, manufacturer = '', supplier = '', unit = excluded.unit,
  unit_cost = null, barcode = '', mpn = '', upc = '', supplier_number = '',
  reorder_point = null, min_stock_level = null, image_url = '', aliases = excluded.aliases
where stockr_materials.company_id = 'co_dayoneelectric';

notify pgrst, 'reload schema';
