-- Hot-path indexes for many company workspaces. Safe to re-run.

create index if not exists stockr_inventory_company_material_idx
  on stockr_inventory (company_id, material_id);
create index if not exists stockr_inventory_company_location_idx
  on stockr_inventory (company_id, location_id);
create index if not exists stockr_transactions_company_created_idx
  on stockr_transactions (company_id, created_at desc);
create index if not exists stockr_materials_company_name_idx
  on stockr_materials (company_id, name);
create index if not exists stockr_materials_company_barcode_idx
  on stockr_materials (company_id, barcode);
create index if not exists stockr_sessions_expires_idx
  on stockr_sessions (expires_at);
create index if not exists stockr_memberships_user_idx
  on stockr_memberships (user_id);
create index if not exists stockr_purchase_orders_company_created_idx
  on stockr_purchase_orders (company_id, created_at desc);
