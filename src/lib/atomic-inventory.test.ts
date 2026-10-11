import assert from "node:assert/strict";
import test from "node:test";
import { applyCommand } from "./mutations.ts";
import { prepareQueuedAction } from "./offline-queue.ts";
import { createEmptyState } from "./seed.ts";

test("bulk inventory validation is all-or-none in the domain layer", () => {
  const state = createEmptyState("Test");
  state.inventory = [
    { id: "inv_1", material_id: "mat_1", location_id: "loc_1", quantity: 10 },
  ];
  state.transactions = [];

  const result = applyCommand(
    state,
    {
      type: "applyBulkActions",
      actions: [
        { type: "use", materialId: "mat_1", quantity: 2, fromLocationId: "loc_1", project: "Job A" },
        { type: "use", materialId: "mat_1", quantity: 20, fromLocationId: "loc_1", project: "Job A" },
      ],
    },
    "worker@example.com",
  );

  assert.match(result.error || "", /Line 2/);
  assert.equal(result.state.inventory[0]?.quantity, 10);
  assert.equal(result.state.transactions.length, 0);
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
