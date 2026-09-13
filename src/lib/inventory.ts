import type { InventoryItem, StoreState, TxType } from "./types";

export function onHand(state: StoreState, materialId: string, locationId?: string) {
  return state.inventory
    .filter(
      (row) =>
        row.material_id === materialId &&
        (locationId ? row.location_id === locationId : true),
    )
    .reduce((sum, row) => sum + (row.quantity || 0), 0);
}

export function materialValue(state: StoreState, materialId: string) {
  const material = state.materials.find((m) => m.id === materialId);
  return onHand(state, materialId) * (material?.unit_cost || 0);
}

export function totalValue(state: StoreState) {
  return state.inventory.reduce((sum, row) => {
    const material = state.materials.find((m) => m.id === row.material_id);
    return sum + (row.quantity || 0) * (material?.unit_cost || 0);
  }, 0);
}

export function bumpQty(
  inventory: InventoryItem[],
  materialId: string,
  locationId: string,
  delta: number,
): InventoryItem[] {
  const next = inventory.map((row) => ({ ...row }));
  const idx = next.findIndex(
    (row) => row.material_id === materialId && row.location_id === locationId,
  );
  if (idx === -1) {
    if (delta <= 0) return next;
    next.push({
      id: `inv_${materialId}_${locationId}_${Date.now()}`,
      material_id: materialId,
      location_id: locationId,
      quantity: delta,
    });
    return next;
  }
  next[idx].quantity = Math.max(0, (next[idx].quantity || 0) + delta);
  return next.filter((row) => row.quantity > 0);
}

export const TX_META: Record<
  TxType,
  { label: string; color: string }
> = {
  add: { label: "Added", color: "bg-green-100 text-green-700 border-green-200" },
  transfer: {
    label: "Transfer",
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  use: { label: "Used", color: "bg-orange-100 text-orange-700 border-orange-200" },
  adjust: {
    label: "Adjusted",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  shrink: {
    label: "Shrinkage",
    color: "bg-red-100 text-red-700 border-red-200",
  },
};

export function actorLabel(email?: string | null) {
  if (!email) return "System";
  if (email.startsWith("service+") || email.includes("@no-reply")) return "System";
  return email.split("@")[0];
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
