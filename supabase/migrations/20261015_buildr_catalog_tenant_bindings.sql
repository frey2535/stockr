-- Never infer a tenant mapping by display name, email, or client-supplied company ID.
-- An authorized administrator must verify both tenant IDs before inserting a binding.
create table if not exists stockr_buildr_tenant_bindings (
  buildr_company_id text primary key,
  stockr_company_id text not null unique references stockr_companies(id) on delete restrict,
  is_active boolean not null default false,
  verified_by text not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tenant_binding_verified_by_not_blank check (length(trim(verified_by)) > 0)
);
create index if not exists stockr_buildr_tenant_bindings_active_idx
  on stockr_buildr_tenant_bindings (buildr_company_id)
  where is_active = true;
alter table stockr_buildr_tenant_bindings enable row level security;
-- No client grants or policies: access only through the server's service-role API.
revoke all on stockr_buildr_tenant_bindings from anon, authenticated;
-- Intentionally no default Day One mapping: verify Buildr's actual tenant ID first.
