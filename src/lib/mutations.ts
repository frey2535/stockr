import { bumpQty } from "./inventory";
import { uid } from "./id";
import { normalizeStoreState } from "./seed";
import { needsProject } from "./tx";
import type {
  AccessCode,
  InventoryAction,
  Location,
  Material,
  Project,
  PurchaseOrder,
  RestockApply,
  Settings,
  StockRule,
  StoreState,
  Tool,
} from "./types";

function withCatalogAliases(material: Partial<Material>) {
  const aliases = new Set(material.aliases || []);
  for (const value of [material.mpn, material.upc, material.supplier_number, material.barcode]) {
    if (value) aliases.add(String(value));
  }
  return Array.from(aliases);
}

export type StoreCommand =
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "upsertLocation"; location: Partial<Location> & { id?: string } }
  | { type: "deleteLocation"; id: string }
  | { type: "upsertMaterial"; material: Partial<Material> & { id?: string } }
  | { type: "upsertMaterials"; materials: Array<Partial<Material> & { id?: string }> }
  | { type: "deleteMaterial"; id: string }
  | { type: "applyAction"; action: InventoryAction }
  | { type: "applyBulkActions"; actions: InventoryAction[] }
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
  | { type: "deletePurchaseOrder"; poId: string }
  | { type: "upsertTool"; tool: Partial<Tool> & { id?: string } }
  | { type: "deleteTool"; id: string }
  | { type: "setStockRule"; rule: Partial<StockRule> & { material_id: string; location_id: string } }
  | { type: "deleteStockRule"; id: string }
  | { type: "applyRestock"; restock: RestockApply }
  | { type: "replaceProjects"; projects: Project[] }
  | { type: "createAccessCode"; label: string; codeType: AccessCode["type"]; days?: number }
  | { type: "toggleAccessCode"; id: string }
  | { type: "resetDemo" };

export function applyCommand(
  prev: StoreState,
  command: StoreCommand,
  actor: string,
  seed?: StoreState,
): { state: StoreState; error?: string; created?: Material | AccessCode | Tool } {
  prev = normalizeStoreState(prev);
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
      const current = prev.materials.find((row) => row.id === command.material.id)!;
      const saved = {
        ...current,
        ...command.material,
        aliases: withCatalogAliases({ ...current, ...command.material }),
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
      mpn: command.material.mpn || "",
      upc: command.material.upc || "",
      supplier_number: command.material.supplier_number || "",
      reorder_point: command.material.reorder_point ?? null,
      min_stock_level: command.material.min_stock_level ?? null,
      image_url: command.material.image_url || "",
      aliases: withCatalogAliases(command.material),
    };
    return { state: { ...prev, materials: [...prev.materials, saved] }, created: saved };
  }

  if (command.type === "upsertMaterials") {
    let current = prev;
    let last: Material | undefined;
    for (const material of command.materials) {
      const result = applyCommand(current, { type: "upsertMaterial", material }, actor, seed);
      if (result.error) return result;
      current = result.state;
      if (result.created && "unit" in result.created) last = result.created;
    }
    return { state: current, created: last };
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
    if (needsProject(action.type) && !String(action.project || "").trim()) {
      return { state: prev, error: "Job / project is required." };
    }

    let inventory = prev.inventory.map((row) => ({ ...row }));
    if (action.type === "add" || action.type === "receive" || action.type === "return") {
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
    } else if (action.type === "adjust" || action.type === "count") {
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

  if (command.type === "applyBulkActions") {
    if (!command.actions.length) return { state: prev, error: "Add at least one line." };
    let current = prev;
    for (const [index, action] of command.actions.entries()) {
      const result = applyCommand(current, { type: "applyAction", action }, actor, seed);
      if (result.error) {
        return { state: prev, error: `Line ${index + 1}: ${result.error}` };
      }
      current = result.state;
    }
    return { state: current };
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
    const existing = prev.purchaseOrders.find((row) => row.id === command.poId);
    if (!existing) return { state: prev, error: "Purchase order not found." };
    return {
      state: {
        ...prev,
        purchaseOrders: prev.purchaseOrders.map((row) =>
          row.id === command.poId ? { ...row, status: command.status } : row,
        ),
      },
    };
  }

  if (command.type === "deletePurchaseOrder") {
    if (!prev.purchaseOrders.some((row) => row.id === command.poId)) {
      return { state: prev, error: "Purchase order not found." };
    }
    return {
      state: {
        ...prev,
        purchaseOrders: prev.purchaseOrders.filter((row) => row.id !== command.poId),
      },
    };
  }

  if (command.type === "upsertTool") {
    if (command.tool.id && prev.tools.some((row) => row.id === command.tool.id)) {
      const saved = {
        ...prev.tools.find((row) => row.id === command.tool.id)!,
        ...command.tool,
        id: command.tool.id,
      };
      return {
        state: {
          ...prev,
          tools: prev.tools.map((row) => (row.id === command.tool.id ? saved : row)),
        },
        created: saved,
      };
    }
    if (!command.tool.assigned_location_id) {
      return { state: prev, error: "Assign the tool to a warehouse or vehicle." };
    }
    const created: Tool = {
      id: uid("tool"),
      name: command.tool.name || "Untitled tool",
      description: command.tool.description || "",
      category: command.tool.category || "",
      barcode: command.tool.barcode || "",
      assigned_location_id: command.tool.assigned_location_id,
      assigned_to: command.tool.assigned_to || "",
      status: command.tool.status || "available",
    };
    return { state: { ...prev, tools: [...prev.tools, created] }, created };
  }

  if (command.type === "deleteTool") {
    return {
      state: {
        ...prev,
        tools: prev.tools.filter((row) => row.id !== command.id),
      },
    };
  }

  if (command.type === "setStockRule") {
    const min = Number(command.rule.min);
    if (!command.rule.material_id || !command.rule.location_id) {
      return { state: prev, error: "Material and location required." };
    }
    if (!Number.isFinite(min) || min < 0) return { state: prev, error: "Min quantity required." };
    const max =
      command.rule.max == null || command.rule.max === ("" as unknown)
        ? null
        : Number(command.rule.max);
    if (max != null && (!Number.isFinite(max) || max < min)) {
      return { state: prev, error: "Max must be greater than or equal to min." };
    }
    const existing = (prev.stockRules || []).find(
      (row) =>
        row.id === command.rule.id ||
        (row.material_id === command.rule.material_id && row.location_id === command.rule.location_id),
    );
    const saved: StockRule = {
      id: existing?.id || command.rule.id || uid("rule"),
      material_id: command.rule.material_id,
      location_id: command.rule.location_id,
      min,
      max,
    };
    const stockRules = existing
      ? (prev.stockRules || []).map((row) => (row.id === existing.id ? saved : row))
      : [...(prev.stockRules || []), saved];
    return { state: { ...prev, stockRules } };
  }

  if (command.type === "deleteStockRule") {
    return {
      state: {
        ...prev,
        stockRules: (prev.stockRules || []).filter((row) => row.id !== command.id),
      },
    };
  }

  if (command.type === "applyRestock") {
    const restock = command.restock;
    if (restock.kind === "transfer") {
      if (!restock.fromLocationId) return { state: prev, error: "Source location required." };
      return applyCommand(
        prev,
        {
          type: "applyAction",
          action: {
            type: "transfer",
            materialId: restock.materialId,
            quantity: restock.quantity,
            fromLocationId: restock.fromLocationId,
            toLocationId: restock.locationId,
            notes: "Truck restock",
          },
        },
        actor,
        seed,
      );
    }
    const material = prev.materials.find((row) => row.id === restock.materialId);
    if (!material) return { state: prev, error: "Material not found." };
    const supplier = restock.supplier || material.supplier || "Supplier";
    const existing = prev.purchaseOrders.find((row) => row.status === "draft" && row.supplier === supplier);
    if (existing) {
      const lines = existing.lines.map((line) => ({ ...line }));
      const line = lines.find((row) => row.material_id === restock.materialId);
      if (line) line.expected_quantity += restock.quantity;
      else {
        lines.push({
          material_id: restock.materialId,
          expected_quantity: restock.quantity,
          received_quantity: 0,
          unit_cost: material.unit_cost || undefined,
        });
      }
      return {
        state: {
          ...prev,
          purchaseOrders: prev.purchaseOrders.map((row) =>
            row.id === existing.id ? { ...row, lines } : row,
          ),
        },
      };
    }
    return applyCommand(
      prev,
      {
        type: "createPurchaseOrder",
        po: {
          po_number: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${uid("po").slice(-4).toUpperCase()}`,
          supplier,
          status: "draft",
          lines: [
            {
              material_id: restock.materialId,
              expected_quantity: restock.quantity,
              received_quantity: 0,
              unit_cost: material.unit_cost || undefined,
            },
          ],
        },
      },
      actor,
      seed,
    );
  }

  if (command.type === "replaceProjects") {
    return { state: { ...prev, projects: command.projects } };
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
