-- Day One Electric tenant-only electrical catalog batch 1 of 4
-- Source: Stockr_Electrical_Catalog_Starter.xlsx. All supplier/manufacturer/MPN/prices are unverified and intentionally blank.

do $$
begin
  if not exists (select 1 from stockr_companies where id = 'co_dayoneelectric') then
    raise exception 'Day One Electric company co_dayoneelectric does not exist.';
  end if;
end $$;

with raw(line) as (
  select unnest(string_to_array($catalog$
STK-E-00001	Conduit	EMT	EMT 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00002	Conduit	EMT	EMT 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00003	Conduit	EMT	EMT 1 in, 10 ft nominal	1	STICK
STK-E-00004	Conduit	EMT	EMT 1-1/4 in, 10 ft nominal	1-1/4	STICK
STK-E-00005	Conduit	EMT	EMT 1-1/2 in, 10 ft nominal	1-1/2	STICK
STK-E-00006	Conduit	EMT	EMT 2 in, 10 ft nominal	2	STICK
STK-E-00007	Conduit	EMT	EMT 2-1/2 in, 10 ft nominal	2-1/2	STICK
STK-E-00008	Conduit	EMT	EMT 3 in, 10 ft nominal	3	STICK
STK-E-00009	Conduit	EMT	EMT 4 in, 10 ft nominal	4	STICK
STK-E-00010	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00011	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00012	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 1 in, 10 ft nominal	1	STICK
STK-E-00013	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 1-1/4 in, 10 ft nominal	1-1/4	STICK
STK-E-00014	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 1-1/2 in, 10 ft nominal	1-1/2	STICK
STK-E-00015	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 2 in, 10 ft nominal	2	STICK
STK-E-00016	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 3 in, 10 ft nominal	3	STICK
STK-E-00017	Conduit	Rigid Metal Conduit (RMC)	Rigid Metal Conduit (RMC) 4 in, 10 ft nominal	4	STICK
STK-E-00018	Conduit	IMC	IMC 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00019	Conduit	IMC	IMC 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00020	Conduit	IMC	IMC 1 in, 10 ft nominal	1	STICK
STK-E-00021	Conduit	IMC	IMC 1-1/4 in, 10 ft nominal	1-1/4	STICK
STK-E-00022	Conduit	IMC	IMC 2 in, 10 ft nominal	2	STICK
STK-E-00023	Conduit	IMC	IMC 3 in, 10 ft nominal	3	STICK
STK-E-00024	Conduit	PVC Schedule 40	PVC Schedule 40 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00025	Conduit	PVC Schedule 40	PVC Schedule 40 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00026	Conduit	PVC Schedule 40	PVC Schedule 40 1 in, 10 ft nominal	1	STICK
STK-E-00027	Conduit	PVC Schedule 40	PVC Schedule 40 1-1/4 in, 10 ft nominal	1-1/4	STICK
STK-E-00028	Conduit	PVC Schedule 40	PVC Schedule 40 1-1/2 in, 10 ft nominal	1-1/2	STICK
STK-E-00029	Conduit	PVC Schedule 40	PVC Schedule 40 2 in, 10 ft nominal	2	STICK
STK-E-00030	Conduit	PVC Schedule 40	PVC Schedule 40 2-1/2 in, 10 ft nominal	2-1/2	STICK
STK-E-00031	Conduit	PVC Schedule 40	PVC Schedule 40 3 in, 10 ft nominal	3	STICK
STK-E-00032	Conduit	PVC Schedule 40	PVC Schedule 40 4 in, 10 ft nominal	4	STICK
STK-E-00033	Conduit	PVC Schedule 40	PVC Schedule 40 5 in, 10 ft nominal	5	STICK
STK-E-00034	Conduit	PVC Schedule 40	PVC Schedule 40 6 in, 10 ft nominal	6	STICK
STK-E-00035	Conduit	PVC Schedule 80	PVC Schedule 80 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00036	Conduit	PVC Schedule 80	PVC Schedule 80 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00037	Conduit	PVC Schedule 80	PVC Schedule 80 1 in, 10 ft nominal	1	STICK
STK-E-00038	Conduit	PVC Schedule 80	PVC Schedule 80 1-1/4 in, 10 ft nominal	1-1/4	STICK
STK-E-00039	Conduit	PVC Schedule 80	PVC Schedule 80 1-1/2 in, 10 ft nominal	1-1/2	STICK
STK-E-00040	Conduit	PVC Schedule 80	PVC Schedule 80 2 in, 10 ft nominal	2	STICK
STK-E-00041	Conduit	PVC Schedule 80	PVC Schedule 80 3 in, 10 ft nominal	3	STICK
STK-E-00042	Conduit	PVC Schedule 80	PVC Schedule 80 4 in, 10 ft nominal	4	STICK
STK-E-00043	Conduit	Flexible Metal Conduit (FMC)	Flexible Metal Conduit (FMC) 3/8 in, 10 ft nominal	3/8	STICK
STK-E-00044	Conduit	Flexible Metal Conduit (FMC)	Flexible Metal Conduit (FMC) 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00045	Conduit	Flexible Metal Conduit (FMC)	Flexible Metal Conduit (FMC) 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00046	Conduit	Flexible Metal Conduit (FMC)	Flexible Metal Conduit (FMC) 1 in, 10 ft nominal	1	STICK
STK-E-00047	Conduit	Liquidtight Flexible Metal (LFMC)	Liquidtight Flexible Metal (LFMC) 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00048	Conduit	Liquidtight Flexible Metal (LFMC)	Liquidtight Flexible Metal (LFMC) 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00049	Conduit	Liquidtight Flexible Metal (LFMC)	Liquidtight Flexible Metal (LFMC) 1 in, 10 ft nominal	1	STICK
STK-E-00050	Conduit	Liquidtight Flexible Metal (LFMC)	Liquidtight Flexible Metal (LFMC) 1-1/4 in, 10 ft nominal	1-1/4	STICK
STK-E-00051	Conduit	Liquidtight Nonmetallic (LFNC)	Liquidtight Nonmetallic (LFNC) 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00052	Conduit	Liquidtight Nonmetallic (LFNC)	Liquidtight Nonmetallic (LFNC) 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00053	Conduit	Liquidtight Nonmetallic (LFNC)	Liquidtight Nonmetallic (LFNC) 1 in, 10 ft nominal	1	STICK
STK-E-00054	Conduit	Electrical Nonmetallic Tubing (ENT)	Electrical Nonmetallic Tubing (ENT) 1/2 in, 10 ft nominal	1/2	STICK
STK-E-00055	Conduit	Electrical Nonmetallic Tubing (ENT)	Electrical Nonmetallic Tubing (ENT) 3/4 in, 10 ft nominal	3/4	STICK
STK-E-00056	Conduit	Electrical Nonmetallic Tubing (ENT)	Electrical Nonmetallic Tubing (ENT) 1 in, 10 ft nominal	1	STICK
STK-E-00057	Conduit Fittings	EMT Connectors - Set Screw	EMT Connectors - Set Screw - 1/2	1/2	EA
STK-E-00058	Conduit Fittings	EMT Connectors - Set Screw	EMT Connectors - Set Screw - 3/4	3/4	EA
STK-E-00059	Conduit Fittings	EMT Connectors - Set Screw	EMT Connectors - Set Screw - 1	1	EA
STK-E-00060	Conduit Fittings	EMT Connectors - Set Screw	EMT Connectors - Set Screw - 1-1/4	1-1/4	EA
STK-E-00061	Conduit Fittings	EMT Connectors - Set Screw	EMT Connectors - Set Screw - 2	2	EA
STK-E-00062	Conduit Fittings	EMT Connectors - Compression	EMT Connectors - Compression - 1/2	1/2	EA
STK-E-00063	Conduit Fittings	EMT Connectors - Compression	EMT Connectors - Compression - 3/4	3/4	EA
STK-E-00064	Conduit Fittings	EMT Connectors - Compression	EMT Connectors - Compression - 1	1	EA
STK-E-00065	Conduit Fittings	EMT Connectors - Compression	EMT Connectors - Compression - 2	2	EA
STK-E-00066	Conduit Fittings	EMT Couplings - Set Screw	EMT Couplings - Set Screw - 1/2	1/2	EA
STK-E-00067	Conduit Fittings	EMT Couplings - Set Screw	EMT Couplings - Set Screw - 3/4	3/4	EA
STK-E-00068	Conduit Fittings	EMT Couplings - Set Screw	EMT Couplings - Set Screw - 1	1	EA
STK-E-00069	Conduit Fittings	EMT Couplings - Set Screw	EMT Couplings - Set Screw - 2	2	EA
STK-E-00070	Conduit Fittings	EMT Couplings - Compression	EMT Couplings - Compression - 1/2	1/2	EA
STK-E-00071	Conduit Fittings	EMT Couplings - Compression	EMT Couplings - Compression - 3/4	3/4	EA
STK-E-00072	Conduit Fittings	EMT Couplings - Compression	EMT Couplings - Compression - 1	1	EA
STK-E-00073	Conduit Fittings	EMT Couplings - Compression	EMT Couplings - Compression - 2	2	EA
STK-E-00074	Conduit Fittings	Rigid/IMC Couplings	Rigid/IMC Couplings - 1/2	1/2	EA
STK-E-00075	Conduit Fittings	Rigid/IMC Couplings	Rigid/IMC Couplings - 3/4	3/4	EA
STK-E-00076	Conduit Fittings	Rigid/IMC Couplings	Rigid/IMC Couplings - 1	1	EA
STK-E-00077	Conduit Fittings	Rigid/IMC Couplings	Rigid/IMC Couplings - 2	2	EA
STK-E-00078	Conduit Fittings	Rigid/IMC Locknuts	Rigid/IMC Locknuts - 1/2	1/2	EA
STK-E-00079	Conduit Fittings	Rigid/IMC Locknuts	Rigid/IMC Locknuts - 3/4	3/4	EA
STK-E-00080	Conduit Fittings	Rigid/IMC Locknuts	Rigid/IMC Locknuts - 1	1	EA
STK-E-00081	Conduit Fittings	Rigid/IMC Locknuts	Rigid/IMC Locknuts - 2	2	EA
STK-E-00082	Conduit Fittings	Insulating Bushings	Insulating Bushings - 1/2	1/2	EA
STK-E-00083	Conduit Fittings	Insulating Bushings	Insulating Bushings - 3/4	3/4	EA
STK-E-00084	Conduit Fittings	Insulating Bushings	Insulating Bushings - 1	1	EA
STK-E-00085	Conduit Fittings	Insulating Bushings	Insulating Bushings - 2	2	EA
STK-E-00086	Conduit Fittings	Grounding Bushings	Grounding Bushings - 1/2	1/2	EA
STK-E-00087	Conduit Fittings	Grounding Bushings	Grounding Bushings - 3/4	3/4	EA
STK-E-00088	Conduit Fittings	Grounding Bushings	Grounding Bushings - 1	1	EA
STK-E-00089	Conduit Fittings	Grounding Bushings	Grounding Bushings - 2	2	EA
STK-E-00090	Conduit Fittings	PVC Couplings	PVC Couplings - 1/2	1/2	EA
STK-E-00091	Conduit Fittings	PVC Couplings	PVC Couplings - 3/4	3/4	EA
STK-E-00092	Conduit Fittings	PVC Couplings	PVC Couplings - 1	1	EA
STK-E-00093	Conduit Fittings	PVC Couplings	PVC Couplings - 2	2	EA
STK-E-00094	Conduit Fittings	PVC Couplings	PVC Couplings - 3	3	EA
STK-E-00095	Conduit Fittings	PVC Couplings	PVC Couplings - 4	4	EA
STK-E-00096	Conduit Fittings	PVC Male Adapters	PVC Male Adapters - 1/2	1/2	EA
STK-E-00097	Conduit Fittings	PVC Male Adapters	PVC Male Adapters - 3/4	3/4	EA
STK-E-00098	Conduit Fittings	PVC Male Adapters	PVC Male Adapters - 1	1	EA
STK-E-00099	Conduit Fittings	PVC Male Adapters	PVC Male Adapters - 2	2	EA
STK-E-00100	Conduit Fittings	PVC Male Adapters	PVC Male Adapters - 3	3	EA
STK-E-00101	Conduit Fittings	PVC Male Adapters	PVC Male Adapters - 4	4	EA
STK-E-00102	Conduit Fittings	PVC Female Adapters	PVC Female Adapters - 1/2	1/2	EA
STK-E-00103	Conduit Fittings	PVC Female Adapters	PVC Female Adapters - 3/4	3/4	EA
STK-E-00104	Conduit Fittings	PVC Female Adapters	PVC Female Adapters - 1	1	EA
STK-E-00105	Conduit Fittings	PVC Female Adapters	PVC Female Adapters - 2	2	EA
STK-E-00106	Conduit Fittings	PVC 90-Degree Elbows	PVC 90-Degree Elbows - 1/2	1/2	EA
STK-E-00107	Conduit Fittings	PVC 90-Degree Elbows	PVC 90-Degree Elbows - 3/4	3/4	EA
STK-E-00108	Conduit Fittings	PVC 90-Degree Elbows	PVC 90-Degree Elbows - 1	1	EA
STK-E-00109	Conduit Fittings	PVC 90-Degree Elbows	PVC 90-Degree Elbows - 2	2	EA
STK-E-00110	Conduit Fittings	PVC 90-Degree Elbows	PVC 90-Degree Elbows - 3	3	EA
STK-E-00111	Conduit Fittings	PVC 90-Degree Elbows	PVC 90-Degree Elbows - 4	4	EA
STK-E-00112	Conduit Fittings	PVC Expansion Fittings	PVC Expansion Fittings - 1	1	EA
STK-E-00113	Conduit Fittings	PVC Expansion Fittings	PVC Expansion Fittings - 2	2	EA
STK-E-00114	Conduit Fittings	PVC Expansion Fittings	PVC Expansion Fittings - 3	3	EA
STK-E-00115	Conduit Fittings	PVC Expansion Fittings	PVC Expansion Fittings - 4	4	EA
STK-E-00116	Conduit Fittings	Liquidtight Connectors	Liquidtight Connectors - 1/2	1/2	EA
STK-E-00117	Conduit Fittings	Liquidtight Connectors	Liquidtight Connectors - 3/4	3/4	EA
STK-E-00118	Conduit Fittings	Liquidtight Connectors	Liquidtight Connectors - 1	1	EA
STK-E-00119	Conduit Fittings	Flex Connectors	Flex Connectors - 3/8	3/8	EA
STK-E-00120	Conduit Fittings	Flex Connectors	Flex Connectors - 1/2	1/2	EA
STK-E-00121	Conduit Fittings	Flex Connectors	Flex Connectors - 3/4	3/4	EA
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
