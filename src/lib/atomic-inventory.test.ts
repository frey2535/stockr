import assert from "node:assert/strict";
import test from "node:test";
import { inventoryOperationKey, prepareInventoryBatch } from "./inventory-operation-policy.ts";
import { prepareQueuedAction } from "./offline-queue.ts";

test("bulk inventory serialization keeps the batch on one operation key", () => {
  const actions = [
    { type: "use" as const, materialId: "mat_1", quantity: 2, fromLocationId: "loc_1", project: "Job A", operationId: "op_batch" },
    { type: "receive" as const, materialId: "mat_2", quantity: 4, toLocationId: "loc_2", operationId: "op_batch" },
  ];

  assert.equal(inventoryOperationKey(actions, "fallback"), "op_batch");

  let sequence = 0;
  const rows = prepareInventoryBatch(actions, () => "tx_" + ++sequence);
  assert.deepEqual(rows, [
    {
      tx_id: "tx_1",
      type: "use",
      material_id: "mat_1",
      quantity: 2,
      from_location_id: "loc_1",
      to_location_id: null,
      project: "Job A",
      notes: "",
    },
    {
      tx_id: "tx_2",
      type: "receive",
      material_id: "mat_2",
      quantity: 4,
      from_location_id: null,
      to_location_id: "loc_2",
      project: "",
      notes: "",
    },
  ]);
});

test("bulk inventory serialization uses a fallback operation key only when needed", () => {
  assert.equal(
    inventoryOperationKey([{ type: "receive", materialId: "mat_1", quantity: 1, toLocationId: "loc_1" }], "op_fallback"),
    "op_fallback",
  );
});

test("offline queue keeps a stable operation id for replay safety", () => {
  const queued = prepareQueuedAction(
    { type: "receive", materialId: "mat_1", quantity: 4, toLocationId: "loc_1" },
    "off_123",
    "2026-10-11T00:00:00.000Z",
  );
  assert.equal(queued.operationId, "off_123");

  const existing = prepareQueuedAction(
    {
      type: "receive",
      materialId: "mat_1",
      quantity: 4,
      toLocationId: "loc_1",
      operationId: "op_existing",
    },
    "off_456",
    "2026-10-11T00:00:00.000Z",
  );
  assert.equal(existing.operationId, "op_existing");
});
