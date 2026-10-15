import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261011_reports_catalog_scale.sql", import.meta.url),
  "utf8",
);

test("catalog facets use distinct database-side values and supporting indexes", () => {
  assert.equal(migration.includes("stockr_catalog_facets"), true);
  assert.equal(migration.includes("select distinct category"), true);
  assert.equal(migration.includes("select distinct sub_category"), true);
  assert.equal(migration.includes("stockr_materials_category_idx"), true);
  assert.equal(migration.includes("stockr_materials_category_subcategory_idx"), true);
});

test("reports aggregate valuation and project usage in Postgres", () => {
  assert.equal(migration.includes("stockr_reports_summary"), true);
  assert.equal(migration.includes("sum(i.quantity * coalesce(m.unit_cost, 0))"), true);
  assert.equal(migration.includes("t.type = 'use'"), true);
  assert.equal(migration.includes("group by coalesce(nullif(trim(t.project), ''), 'Unassigned')"), true);
  assert.equal(migration.includes("stockr_transactions_reports_idx"), true);
});
