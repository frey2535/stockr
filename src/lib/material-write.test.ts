import assert from "node:assert/strict";
import test from "node:test";
import { materialWriteRow } from "./material-write.ts";
import type { Material } from "./types.ts";

const material: Material = {
  id: "mat_1",
  name: "EMT 1/2 in",
  description: "Starter SKU",
  category: "Conduit",
  sub_category: "EMT",
  manufacturer: "",
  supplier: "",
  unit: "stick",
  unit_cost: null,
  barcode: "STK-E-00001",
  mpn: "hidden",
  upc: "123",
  supplier_number: "s-1",
  reorder_point: null,
  min_stock_level: null,
  image_url: "",
  aliases: ["STK-E-00001"],
};

test("material writes include identity columns until production omits them", () => {
  const row = materialWriteRow("co_dayone", material);
  assert.equal(row.company_id, "co_dayone");
  assert.equal(row.mpn, "hidden");
  assert.deepEqual(row.aliases, ["STK-E-00001"]);
});

test("material writes retry without missing PostgREST columns", () => {
  const row = materialWriteRow("co_dayone", material, ["mpn", "upc", "supplier_number", "aliases"]);
  assert.equal("mpn" in row, false);
  assert.equal("aliases" in row, false);
  assert.equal(row.name, "EMT 1/2 in");
  assert.equal(row.barcode, "STK-E-00001");
});
