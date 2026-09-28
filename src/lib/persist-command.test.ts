import assert from "node:assert/strict";
import test from "node:test";

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
