import assert from "node:assert/strict";
import test from "node:test";
import { materialColumnsToOmit } from "./material-columns.ts";

function bumpQty(
  inventory: { id: string; material_id: string; location_id: string; quantity: number }[],
  materialId: string,
  locationId: string,
  delta: number,
) {
  return inventory.map((row) =>
    row.material_id === materialId && row.location_id === locationId
      ? { ...row, quantity: row.quantity + delta }
      : row,
  );
}

test("bumping one SKU leaves the other SKU untouched", () => {
  const next = bumpQty(
    [
      { id: "inv_1", material_id: "mat_wire", location_id: "loc_a", quantity: 10 },
      { id: "inv_2", material_id: "mat_screw", location_id: "loc_a", quantity: 50 },
    ],
    "mat_wire",
    "loc_a",
    -2,
  );
  assert.equal(next.find((row) => row.material_id === "mat_screw")?.quantity, 50);
  assert.equal(next.find((row) => row.material_id === "mat_wire")?.quantity, 8);
});

test("omits mpn when PostgREST reports a missing npm or mpn column", () => {
  assert.deepEqual(
    materialColumnsToOmit("Could not find the 'npm' column of 'stockr_materials' in the schema cache"),
    ["mpn"],
  );
  assert.deepEqual(
    materialColumnsToOmit("Could not find the 'mpn' column of 'stockr_materials' in the schema cache"),
    ["mpn"],
  );
});

test("omits identity columns when the schema cache error has no column name", () => {
  assert.deepEqual(materialColumnsToOmit("Could not find the column in the schema cache"), [
    "mpn",
    "upc",
    "supplier_number",
    "aliases",
  ]);
});
