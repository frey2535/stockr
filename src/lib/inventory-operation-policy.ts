import type { InventoryAction } from "./types.ts";

export type InventoryRpcAction = {
  tx_id: string;
  type: InventoryAction["type"];
  material_id: string;
  quantity: number;
  from_location_id: string | null;
  to_location_id: string | null;
  project: string;
  notes: string;
};

export function inventoryOperationKey(actions: InventoryAction[], fallback: string) {
  return actions.find((action) => action.operationId)?.operationId || fallback;
}

export function prepareInventoryBatch(
  actions: InventoryAction[],
  txIdFactory: () => string,
): InventoryRpcAction[] {
  return actions.map((action) => ({
    tx_id: txIdFactory(),
    type: action.type,
    material_id: action.materialId,
    quantity: Number(action.quantity),
    from_location_id: action.fromLocationId || null,
    to_location_id: action.toLocationId || null,
    project: action.project || "",
    notes: action.notes || "",
  }));
}
