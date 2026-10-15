import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261011_enterprise_catalog_import.sql", import.meta.url),
  "utf8",
);

test("catalog import has a company-scoped audit record", () => {
  assert.equal(migration.includes("stockr_catalog_imports"), true);
  assert.equal(migration.includes("company_id text not null references stockr_companies"), true);
  assert.equal(migration.includes("created_count"), true);
  assert.equal(migration.includes("error_message"), true);
});

test("catalog import locks the company and enforces plan material limits transactionally", () => {
  assert.equal(migration.includes("pg_advisory_xact_lock"), true);
  assert.equal(migration.includes("current_materials + created_count + 1 > p_max_materials"), true);
  assert.equal(migration.includes("Catalog import exceeds the company material limit"), true);
});

test("catalog import prices require approved supplier provenance", () => {
  assert.equal(migration.includes("and enabled = true"), true);
  assert.equal(migration.includes("and approved = true"), true);
  assert.equal(migration.includes("price requires an approved supplier source"), true);
  assert.equal(migration.includes("'price_file'"), true);
  assert.equal(migration.includes("p_source_reference"), true);
});

test("catalog import matches existing materials only by strong company-scoped identifiers", () => {
  assert.equal(migration.includes("where company_id = p_company_id and upc = v_upc"), true);
  assert.equal(migration.includes("where company_id = p_company_id and barcode = v_barcode"), true);
  assert.equal(migration.includes("lower(trim(manufacturer)) = lower(v_manufacturer)"), true);
  assert.equal(migration.includes("identifier matches multiple catalog items"), true);
});
