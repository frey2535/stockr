import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { restockMaterialIds } from "./restock-scope.ts";

test("50k stock rules are reduced to a bounded unique material scope", () => {
  const rules = Array.from({ length: 50_000 }, (_, index) => ({
    material_id: "mat_" + (index % 10_000),
  }));
  const started = performance.now();
  const ids = restockMaterialIds(rules);
  const elapsed = performance.now() - started;

  assert.equal(ids.length, 10_000);
  assert.equal(ids[0], "mat_0");
  assert.equal(ids[9_999], "mat_9999");
  assert.ok(elapsed < 1_500, "50k-rule scoping exceeded 1.5s in CI: " + elapsed.toFixed(1) + "ms");
});

test("dashboard scale migration performs aggregation inside Postgres", () => {
  const migration = readFileSync(
    new URL("../../supabase/migrations/20261011_dashboard_scale.sql", import.meta.url),
    "utf8",
  );
  assert.equal(migration.includes("stockr_dashboard_summary"), true);
  assert.equal(migration.includes("sum(i.quantity)"), true);
  assert.equal(migration.includes("sum(i.quantity * coalesce(m.unit_cost, 0))"), true);
  assert.equal(migration.includes("count(distinct case when i.quantity > 0 then i.material_id end)"), true);
  assert.equal(migration.includes("limit 25"), true);
});
