import { onHand } from "./inventory";
import type { RestockNeed, StoreState } from "./types";

type RestockState = Pick<StoreState, "materials" | "locations" | "inventory" | "stockRules">;

function locationQty(state: RestockState, materialId: string, locationId: string) {
  return onHand(state as StoreState, materialId, locationId);
}

export function listRestockNeeds(state: RestockState): RestockNeed[] {
  const needs: RestockNeed[] = [];
  for (const rule of state.stockRules || []) {
    const material = state.materials.find((row) => row.id === rule.material_id);
    const location = state.locations.find((row) => row.id === rule.location_id);
    if (!material || !location) continue;
    const qty = locationQty(state, rule.material_id, rule.location_id);
    if (qty >= rule.min) continue;
    const target = rule.max != null && rule.max > rule.min ? rule.max : rule.min;
    const need = Math.max(0, target - qty);
    if (need <= 0) continue;

    const source = state.locations
      .filter((row) => row.id !== location.id)
      .map((row) => {
        const sourceRule = (state.stockRules || []).find(
          (item) => item.material_id === rule.material_id && item.location_id === row.id,
        );
        const available = Math.max(0, locationQty(state, rule.material_id, row.id) - (sourceRule?.min || 0));
        return { location: row, available };
      })
      .filter((row) => row.available > 0)
      .sort((a, b) => {
        if (a.location.type !== b.location.type) return a.location.type === "warehouse" ? -1 : 1;
        return b.available - a.available;
      })[0];

    const id = `${rule.material_id}:${rule.location_id}`;
    const base = {
      id,
      materialId: material.id,
      materialName: material.name,
      unit: material.unit,
      locationId: location.id,
      locationName: location.name,
      locationType: location.type,
      onHand: qty,
      min: rule.min,
      max: rule.max ?? rule.min,
      need,
    };

    if (source) {
      needs.push({
        ...base,
        suggestion: {
          kind: "transfer",
          fromLocationId: source.location.id,
          fromLocationName: source.location.name,
          quantity: Math.min(need, source.available),
          available: source.available,
        },
      });
    } else {
      needs.push({
        ...base,
        suggestion: {
          kind: "draft_po",
          supplier: material.supplier || "Supplier",
          quantity: need,
        },
      });
    }
  }
  return needs.sort((a, b) => {
    if (a.locationType !== b.locationType) return a.locationType === "vehicle" ? -1 : 1;
    return a.locationName.localeCompare(b.locationName) || a.materialName.localeCompare(b.materialName);
  });
}
