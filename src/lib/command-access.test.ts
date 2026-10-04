import assert from "node:assert/strict";
import test from "node:test";
import { canChangeBilling, commandAccessError, fieldOpsAccessError } from "./command-access.ts";

test("legacy members and technicians can change field inventory but not company setup", () => {
  for (const role of ["member", "technician"] as const) {
    assert.equal(commandAccessError(role, "applyAction"), "");
    assert.equal(commandAccessError(role, "applyBulkActions"), "");
    assert.equal(commandAccessError(role, "updateSettings").length > 0, true);
    assert.equal(commandAccessError(role, "createPurchaseOrder").length > 0, true);
  }
});

test("specialized inventory roles are enforced server side", () => {
  assert.equal(commandAccessError("inventory_admin", "upsertMaterial"), "");
  assert.equal(commandAccessError("inventory_admin", "updateSettings").length > 0, true);
  assert.equal(commandAccessError("warehouse_manager", "receivePurchaseOrder"), "");
  assert.equal(commandAccessError("warehouse_manager", "upsertLocation"), "");
  assert.equal(commandAccessError("foreman", "applyRestock"), "");
  assert.equal(commandAccessError("foreman", "upsertMaterial").length > 0, true);
  assert.equal(commandAccessError("viewer", "applyAction").length > 0, true);
});

test("only owners can reset and only owner/admin can bill", () => {
  assert.equal(commandAccessError("owner", "resetDemo"), "");
  assert.equal(commandAccessError("admin", "resetDemo").length > 0, true);
  assert.equal(canChangeBilling("member"), false);
  assert.equal(canChangeBilling("inventory_admin"), false);
  assert.equal(canChangeBilling("owner"), true);
  assert.equal(canChangeBilling("admin"), true);
});

test("field operations use least privilege", () => {
  assert.equal(fieldOpsAccessError("technician", "createRequest"), "");
  assert.equal(fieldOpsAccessError("technician", "submitCount").length > 0, true);
  assert.equal(fieldOpsAccessError("foreman", "reserve"), "");
  assert.equal(fieldOpsAccessError("foreman", "createBin").length > 0, true);
  assert.equal(fieldOpsAccessError("warehouse_manager", "submitCount"), "");
  assert.equal(fieldOpsAccessError("inventory_admin", "createZone"), "");
  assert.equal(fieldOpsAccessError("viewer", "createRequest").length > 0, true);
});
