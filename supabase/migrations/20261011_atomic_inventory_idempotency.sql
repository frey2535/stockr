-- Atomic, replay-safe inventory operations.
-- Safe to run more than once.

create table if not exists stockr_operation_keys (
  company_id text not null references stockr_companies (id) on delete cascade,
  operation_key text not null,
  operation_type text not null,
  created_at timestamptz not null default now(),
  primary key (company_id, operation_key)
);

alter table stockr_operation_keys enable row level security;
drop policy if exists stockr_deny_anon on stockr_operation_keys;
create policy stockr_deny_anon on stockr_operation_keys
  for all to anon, authenticated using (false) with check (false);

create index if not exists stockr_operation_keys_created_idx
  on stockr_operation_keys (company_id, created_at desc);

create or replace function stockr_apply_inventory_action_once(
  p_company_id text,
  p_operation_key text,
  p_tx_id text,
  p_type text,
  p_material_id text,
  p_quantity numeric,
  p_from_location_id text,
  p_to_location_id text,
  p_project text,
  p_notes text,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Operation key required.';
  end if;

  insert into stockr_operation_keys (company_id, operation_key, operation_type)
  values (p_company_id, p_operation_key, 'inventory_action')
  on conflict (company_id, operation_key) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  perform stockr_apply_inventory_action(
    p_company_id,
    p_tx_id,
    p_type,
    p_material_id,
    p_quantity,
    p_from_location_id,
    p_to_location_id,
    p_project,
    p_notes,
    p_created_by
  );

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function stockr_apply_inventory_action_once(
  text, text, text, text, text, numeric, text, text, text, text, text
) from public;
grant execute on function stockr_apply_inventory_action_once(
  text, text, text, text, text, numeric, text, text, text, text, text
) to service_role;

create or replace function stockr_apply_inventory_batch_once(
  p_company_id text,
  p_operation_key text,
  p_actions jsonb,
  p_created_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
  action_row jsonb;
  line_number integer := 0;
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Operation key required.';
  end if;
  if p_actions is null or jsonb_typeof(p_actions) <> 'array' or jsonb_array_length(p_actions) = 0 then
    raise exception 'At least one inventory action is required.';
  end if;

  insert into stockr_operation_keys (company_id, operation_key, operation_type)
  values (p_company_id, p_operation_key, 'inventory_batch')
  on conflict (company_id, operation_key) do nothing;

  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('applied', false, 'duplicate', true);
  end if;

  for action_row in select value from jsonb_array_elements(p_actions)
  loop
    line_number := line_number + 1;
    begin
      perform stockr_apply_inventory_action(
        p_company_id,
        action_row->>'tx_id',
        action_row->>'type',
        action_row->>'material_id',
        coalesce(nullif(action_row->>'quantity', '')::numeric, 0),
        nullif(action_row->>'from_location_id', ''),
        nullif(action_row->>'to_location_id', ''),
        coalesce(action_row->>'project', ''),
        coalesce(action_row->>'notes', ''),
        p_created_by
      );
    exception
      when others then
        raise exception 'Line %: %', line_number, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('applied', true, 'duplicate', false);
end;
$$;

revoke all on function stockr_apply_inventory_batch_once(text, text, jsonb, text) from public;
grant execute on function stockr_apply_inventory_batch_once(text, text, jsonb, text) to service_role;

notify pgrst, 'reload schema';
