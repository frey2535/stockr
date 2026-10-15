import assert from "node:assert/strict";
import test from "node:test";
import { canChangeBilling, canManagePurchasing, canReceivePurchasing, commandAccessError, commandPayloadAccessError, fieldOpsAccessError } from "./command-access.ts";

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
  assert.equal(commandAccessError("warehouse_manager", "createPurchaseOrder").length > 0, true);
  assert.equal(commandAccessError("warehouse_manager", "upsertLocation"), "");
  assert.equal(commandAccessError("foreman", "receivePurchaseOrder").length > 0, true);
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
  assert.equal(fieldOpsAccessError("inventory_admin", "authorizePurchasing"), "");
  assert.match(fieldOpsAccessError("warehouse_manager", "authorizePurchasing"), /authorize purchasing/i);
  assert.match(fieldOpsAccessError("foreman", "convertToProcurement"), /authorize purchasing/i);
});


test("purchasing authority is separate from field and warehouse inventory work", () => {
  assert.equal(canManagePurchasing("owner"), true);
  assert.equal(canManagePurchasing("admin"), true);
  assert.equal(canManagePurchasing("inventory_admin"), true);
  assert.equal(canManagePurchasing("warehouse_manager"), false);
  assert.equal(canManagePurchasing("foreman"), false);

  assert.equal(canReceivePurchasing("warehouse_manager"), true);
  assert.equal(canReceivePurchasing("foreman"), false);

  assert.equal(
    commandPayloadAccessError("foreman", {
      type: "applyRestock",
      restock: {
        kind: "transfer",
        materialId: "mat_1",
        locationId: "loc_2",
        fromLocationId: "loc_1",
        quantity: 5,
      },
    }),
    "",
  );
  assert.match(
    commandPayloadAccessError("foreman", {
      type: "applyRestock",
      restock: {
        kind: "draft_po",
        materialId: "mat_1",
        locationId: "loc_2",
        quantity: 5,
      },
    }),
    /draft purchase order/i,
  );
});
