import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY_ONE_CATALOG,
  DAY_ONE_CATALOG_COUNT,
  DAY_ONE_COMPANY_ID,
} from "./dayone-catalog.ts";

test("Day One starter catalog is complete and tenant-specific", () => {
  assert.equal(DAY_ONE_COMPANY_ID, "co_dayoneelectric");
  assert.equal(DAY_ONE_CATALOG_COUNT, 484);
  assert.equal(DAY_ONE_CATALOG.length, 484);
  assert.equal(new Set(DAY_ONE_CATALOG.map((item) => item.sku)).size, 484);
  assert.equal(DAY_ONE_CATALOG[0]?.sku, "STK-E-00001");
  assert.equal(DAY_ONE_CATALOG.at(-1)?.sku, "STK-E-00484");
});

test("Day One starter catalog carries no supplier pricing claims", () => {
  for (const item of DAY_ONE_CATALOG) {
    assert.equal("price" in item, false);
    assert.equal("supplier" in item, false);
    assert.equal("manufacturer" in item, false);
    assert.equal("mpn" in item, false);
  }
});
