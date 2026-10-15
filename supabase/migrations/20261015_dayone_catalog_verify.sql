-- Verify Day One Electric tenant-only starter catalog.
do $$
declare
  dayone_count integer;
  leaked_count integer;
begin
  select count(*) into dayone_count
  from stockr_materials
  where company_id = 'co_dayoneelectric'
    and id like 'dayone_stk_e_%';

  if dayone_count <> 484 then
    raise exception 'Day One catalog validation failed: expected 484 rows, found %.', dayone_count;
  end if;

  select count(*) into leaked_count
  from stockr_materials
  where id like 'dayone_stk_e_%'
    and company_id <> 'co_dayoneelectric';

  if leaked_count <> 0 then
    raise exception 'Day One catalog tenant isolation failed: % rows found outside co_dayoneelectric.', leaked_count;
  end if;
end $$;
