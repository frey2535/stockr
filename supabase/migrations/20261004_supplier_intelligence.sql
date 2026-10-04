-- Supplier Intelligence migration
-- Safe to run more than once in the Stockr Supabase SQL Editor.

alter table stockr_companies
  add column if not exists supplier_web_search boolean not null default true;

alter table stockr_companies
  add column if not exists allow_broad_web_search boolean not null default true;

create table if not exists stockr_suppliers (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  name text not null,
  website_url text not null default '',
  domain text not null default '',
  priority integer not null default 100,
  enabled boolean not null default true,
  approved boolean not null default true,
  branch_name text,
  account_reference text,
  allow_substitutes boolean not null default true,
  web_search_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists stockr_supplier_offers (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  supplier_id text not null references stockr_suppliers (id) on delete cascade,
  material_id text references stockr_materials (id) on delete set null,
  product_name text not null,
  manufacturer text,
  mpn text,
  upc text,
  supplier_sku text,
  price numeric,
  currency text not null default 'USD',
  unit text,
  product_url text,
  source_type text not null,
  source_reference text,
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  exact_match boolean not null default false,
  constraint stockr_supplier_offer_price_nonnegative check (price is null or price >= 0)
);

create table if not exists stockr_sourcing_rules (
  id text primary key,
  company_id text not null references stockr_companies (id) on delete cascade,
  category text not null,
  preferred_supplier_id text references stockr_suppliers (id) on delete set null,
  preferred_manufacturer text,
  allow_substitutes boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists stockr_suppliers_company_priority_idx
  on stockr_suppliers (company_id, enabled, priority);

create index if not exists stockr_supplier_offers_lookup_idx
  on stockr_supplier_offers (company_id, mpn, upc, supplier_sku);

create index if not exists stockr_supplier_offers_supplier_idx
  on stockr_supplier_offers (company_id, supplier_id, observed_at desc);

create unique index if not exists stockr_sourcing_rules_category_idx
  on stockr_sourcing_rules (company_id, lower(category));

alter table stockr_suppliers enable row level security;
alter table stockr_supplier_offers enable row level security;
alter table stockr_sourcing_rules enable row level security;

drop policy if exists stockr_deny_anon on stockr_suppliers;
drop policy if exists stockr_deny_anon on stockr_supplier_offers;
drop policy if exists stockr_deny_anon on stockr_sourcing_rules;

create policy stockr_deny_anon on stockr_suppliers
  for all to anon, authenticated using (false) with check (false);

create policy stockr_deny_anon on stockr_supplier_offers
  for all to anon, authenticated using (false) with check (false);

create policy stockr_deny_anon on stockr_sourcing_rules
  for all to anon, authenticated using (false) with check (false);

notify pgrst, 'reload schema';
