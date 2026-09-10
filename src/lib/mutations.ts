import { bumpQty } from "./inventory";
import { uid } from "./id";
import type {
  AccessCode,
  InventoryAction,
  Location,
  Material,
  PurchaseOrder,
  Settings,
  StoreState,
} from "./types";

export type StoreCommand =
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "upsertLocation"; location: Partial<Location> & { id?: string } }
  | { type: "deleteLocation"; id: string }
  | { type: "upsertMaterial"; material: Partial<Material> & { id?: string } }
  | { type: "deleteMaterial"; id: string }
  | { type: "applyAction"; action: InventoryAction }
  | { type: "deleteTransaction"; id: string }
  | {
      type: "createPurchaseOrder";
      po: Omit<PurchaseOrder, "id" | "created_at" | "status"> & {
        status?: PurchaseOrder["status"];
      };
    }
  | {
      type: "receivePurchaseOrder";
      poId: string;
      locationId: string;
      receipts: { material_id: string; quantity: number }[];
    }
  | { type: "setPurchaseOrderStatus"; poId: string; status: PurchaseOrder["status"] }
  | { type: "createAccessCode"; label: string; codeType: AccessCode["type"]; days?: number }
  | { type: "toggleAccessCode"; id: string }
  | { type: "resetDemo" };

export function applyCommand(
  prev: StoreState,
  command: StoreCommand,
  actor: string,
  seed?: StoreState,
): { state: StoreState; error?: string; created?: Material | AccessCode } {
  if (command.type === "updateSettings") {
    return { state: { ...prev, settings: { ...prev.settings, ...command.patch } } };
  }

  if (command.type === "upsertLocation") {
    if (command.location.id) {
      return {
        state: {
          ...prev,
          locations: prev.locations.map((row) =>
            row.id === command.location.id ? { ...row, ...command.location, id: row.id } : row,
          ),
        },
      };
    }
    const created: Location = {
      id: uid("loc"),
      name: command.location.name || "Untitled",
      type: command.location.type || "warehouse",
      description: command.location.description,
      assigned_to: command.location.assigned_to,
    };
    return { state: { ...prev, locations: [...prev.locations, created] } };
  }

  if (command.type === "deleteLocation") {
    return {
      state: {
        ...prev,
        locations: prev.locations.filter((row) => row.id !== command.id),
        inventory: prev.inventory.filter((row) => row.location_id !== command.id),
      },
    };
  }

  if (command.type === "upsertMaterial") {
    if (command.material.id && prev.materials.some((row) => row.id === command.material.id)) {
      const saved = {
        ...prev.materials.find((row) => row.id === command.material.id)!,
        ...command.material,
      };
      return {
        state: {
          ...prev,
          materials: prev.materials.map((row) => (row.id === command.material.id ? saved : row)),
        },
        created: saved,
      };
    }
    const saved: Material = {
      id: uid("mat"),
      name: command.material.name || "Untitled material",
      unit: command.material.unit || "each",
      description: command.material.description || "",
      category: command.material.category || "",
      sub_category: command.material.sub_category || "",
      manufacturer: command.material.manufacturer || "",
      supplier: command.material.supplier || "",
      unit_cost: command.material.unit_cost ?? null,
      barcode: command.material.barcode || "",
      reorder_point: command.material.reorder_point ?? null,
      min_stock_level: command.material.min_stock_level ?? null,
      image_url: command.material.image_url || "",
      aliases: command.material.aliases || [],
    };
    return { state: { ...prev, materials: [...prev.materials, saved] }, created: saved };
  }

  if (command.type === "deleteMaterial") {
    return {
      state: {
        ...prev,
        materials: prev.materials.filter((row) => row.id !== command.id),
        inventory: prev.inventory.filter((row) => row.material_id !== command.id),
      },
    };
  }

  if (command.type === "applyAction") {
    const action = command.action;
    const qty = Number(action.quantity);
    if (!action.materialId) return { state: prev, error: "Select a material." };
    if (!qty || qty <= 0) return { state: prev, error: "Quantity must be greater than zero." };

    let inventory = prev.inventory.map((row) => ({ ...row }));
    if (action.type === "add") {
      if (!action.toLocationId) return { state: prev, error: "Destination location required." };
      inventory = bumpQty(inventory, action.materialId, action.toLocationId, qty);
    } else if (action.type === "use" || action.type === "shrink") {
      if (!action.fromLocationId) return { state: prev, error: "Source location required." };
      const have =
        inventory.find(
          (row) =>
            row.material_id === action.materialId && row.location_id === action.fromLocationId,
        )?.quantity ?? 0;
      if (have < qty) return { state: prev, error: `Only ${have} on hand at that location.` };
      inventory = bumpQty(inventory, action.materialId, action.fromLocationId, -qty);
    } else if (action.type === "transfer") {
      if (!action.fromLocationId || !action.toLocationId) {
        return { state: prev, error: "Both source and destination required." };
      }
      if (action.fromLocationId === action.toLocationId) {
        return { state: prev, error: "Pick two different locations." };
      }
      const have =
        inventory.find(
          (row) =>
            row.material_id === action.materialId && row.location_id === action.fromLocationId,
        )?.quantity ?? 0;
      if (have < qty) return { state: prev, error: `Only ${have} on hand at the source location.` };
      inventory = bumpQty(inventory, action.materialId, action.fromLocationId, -qty);
      inventory = bumpQty(inventory, action.materialId, action.toLocationId, qty);
    } else if (action.type === "adjust") {
      const locationId = action.toLocationId || action.fromLocationId;
      if (!locationId) return { state: prev, error: "Location required." };
      inventory = inventory.filter(
        (row) => !(row.material_id === action.materialId && row.location_id === locationId),
      );
      if (qty > 0) {
        inventory.push({
          id: uid("inv"),
          material_id: action.materialId,
          location_id: locationId,
          quantity: qty,
        });
      }
    }

    return {
      state: {
        ...prev,
        inventory,
        transactions: [
          {
            id: uid("tx"),
            type: action.type,
            material_id: action.materialId,
            quantity: qty,
            from_location_id: action.fromLocationId || null,
            to_location_id: action.toLocationId || null,
            project: action.project || null,
            notes: action.notes || "",
            created_at: new Date().toISOString(),
            created_by: actor,
          },
          ...prev.transactions,
        ],
      },
    };
  }

  if (command.type === "deleteTransaction") {
    return {
      state: {
        ...prev,
        transactions: prev.transactions.filter((row) => row.id !== command.id),
      },
    };
  }

  if (command.type === "createPurchaseOrder") {
    return {
      state: {
        ...prev,
        purchaseOrders: [
          {
            ...command.po,
            id: uid("po"),
            status: command.po.status || "ordered",
            created_at: new Date().toISOString(),
          },
          ...prev.purchaseOrders,
        ],
      },
    };
  }

  if (command.type === "receivePurchaseOrder") {
    const po = prev.purchaseOrders.find((row) => row.id === command.poId);
    if (!po) return { state: prev, error: "Purchase order not found." };
    let inventory = prev.inventory.map((row) => ({ ...row }));
    const lines = po.lines.map((line) => ({ ...line }));
    const txs = [...prev.transactions];
    for (const receipt of command.receipts) {
      if (!receipt.quantity) continue;
      const line = lines.find((row) => row.material_id === receipt.material_id);
      if (!line) continue;
      const remaining = line.expected_quantity - line.received_quantity;
      const qty = Math.min(receipt.quantity, Math.max(0, remaining));
      if (qty <= 0) continue;
      line.received_quantity += qty;
      inventory = bumpQty(inventory, receipt.material_id, command.locationId, qty);
      txs.unshift({
        id: uid("tx"),
        type: "add",
        material_id: receipt.material_id,
        quantity: qty,
        to_location_id: command.locationId,
        notes: po.po_number,
        created_at: new Date().toISOString(),
        created_by: actor,
      });
    }
    const allReceived = lines.every((line) => line.received_quantity >= line.expected_quantity);
    const anyReceived = lines.some((line) => line.received_quantity > 0);
    const status = allReceived ? "received" : anyReceived ? "partial" : po.status;
    return {
      state: {
        ...prev,
        inventory,
        transactions: txs,
        purchaseOrders: prev.purchaseOrders.map((row) =>
          row.id === command.poId ? { ...row, lines, status } : row,
        ),
      },
    };
  }

  if (command.type === "setPurchaseOrderStatus") {
    return {
      state: {
        ...prev,
        purchaseOrders: prev.purchaseOrders.map((row) =>
          row.id === command.poId ? { ...row, status: command.status } : row,
        ),
      },
    };
  }

  if (command.type === "createAccessCode") {
    const created: AccessCode = {
      id: uid("ac"),
      code: `${(command.label || "CODE").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "STOCK"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      type: command.codeType,
      label: command.label,
      expires_at:
        command.codeType === "trial"
          ? new Date(Date.now() + (command.days || 14) * 86400000).toISOString()
          : null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    return { state: { ...prev, accessCodes: [created, ...prev.accessCodes] }, created };
  }

  if (command.type === "toggleAccessCode") {
    return {
      state: {
        ...prev,
        accessCodes: prev.accessCodes.map((row) =>
          row.id === command.id ? { ...row, is_active: !row.is_active } : row,
        ),
      },
    };
  }

  if (command.type === "resetDemo") {
    return { state: seed ?? prev };
  }

  return { state: prev, error: "Unknown command." };
}
