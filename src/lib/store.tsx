"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AccessCode,
  InventoryAction,
  Location,
  Material,
  PurchaseOrder,
  Settings,
  StoreState,
} from "./types";
import { createSeedState } from "./seed";
import { bumpQty } from "./inventory";
import { uid } from "./id";

const STORAGE_KEY = "stockr-store-v1";

function cloneState(): StoreState {
  return createSeedState();
}

function loadState(): StoreState {
  if (typeof window === "undefined") return cloneState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneState();
    const parsed = JSON.parse(raw) as StoreState;
    const seed = cloneState();
    return {
      ...seed,
      ...parsed,
      settings: { ...seed.settings, ...parsed.settings },
    };
  } catch {
    return cloneState();
  }
}

function persist(state: StoreState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

type StoreApi = {
  state: StoreState;
  hydrated: boolean;
  resetDemo: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  upsertLocation: (location: Partial<Location> & { id?: string }) => void;
  deleteLocation: (id: string) => void;
  upsertMaterial: (material: Partial<Material> & { id?: string }) => Material;
  deleteMaterial: (id: string) => void;
  applyAction: (action: InventoryAction) => { ok: true } | { ok: false; error: string };
  deleteTransaction: (id: string) => void;
  createPurchaseOrder: (po: Omit<PurchaseOrder, "id" | "created_at" | "status"> & { status?: PurchaseOrder["status"] }) => void;
  receivePurchaseOrder: (
    poId: string,
    locationId: string,
    receipts: { material_id: string; quantity: number }[],
  ) => { ok: true } | { ok: false; error: string };
  setPurchaseOrderStatus: (poId: string, status: PurchaseOrder["status"]) => void;
  createAccessCode: (input: { label: string; type: AccessCode["type"]; days?: number }) => AccessCode;
  toggleAccessCode: (id: string) => void;
};

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(cloneState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const loaded = loadState();
    stateRef.current = loaded;
    setState(loaded);
    setHydrated(true);
  }, []);

  const commit = useCallback((updater: (prev: StoreState) => StoreState) => {
    const next = updater(stateRef.current);
    stateRef.current = next;
    persist(next);
    setState(next);
    return next;
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      hydrated,
      resetDemo: () => {
        const next = cloneState();
        persist(next);
        setState(next);
      },
      updateSettings: (patch) =>
        commit((prev) => ({
          ...prev,
          settings: { ...prev.settings, ...patch },
        })),
      upsertLocation: (location) =>
        commit((prev) => {
          if (location.id) {
            return {
              ...prev,
              locations: prev.locations.map((row) =>
                row.id === location.id ? { ...row, ...location, id: row.id } : row,
              ),
            };
          }
          const created: Location = {
            id: uid("loc"),
            name: location.name || "Untitled",
            type: location.type || "warehouse",
            description: location.description,
            assigned_to: location.assigned_to,
          };
          return { ...prev, locations: [...prev.locations, created] };
        }),
      deleteLocation: (id) =>
        commit((prev) => ({
          ...prev,
          locations: prev.locations.filter((row) => row.id !== id),
          inventory: prev.inventory.filter((row) => row.location_id !== id),
        })),
      upsertMaterial: (material) => {
        let saved: Material = {
          id: material.id || uid("mat"),
          name: material.name || "Untitled material",
          unit: material.unit || "each",
          ...material,
        };
        commit((prev) => {
          if (material.id && prev.materials.some((row) => row.id === material.id)) {
            saved = { ...prev.materials.find((row) => row.id === material.id)!, ...material };
            return {
              ...prev,
              materials: prev.materials.map((row) =>
                row.id === material.id ? saved : row,
              ),
            };
          }
          saved = {
            id: uid("mat"),
            name: material.name || "Untitled material",
            unit: material.unit || "each",
            description: material.description || "",
            category: material.category || "",
            sub_category: material.sub_category || "",
            manufacturer: material.manufacturer || "",
            supplier: material.supplier || "",
            unit_cost: material.unit_cost ?? null,
            barcode: material.barcode || "",
            reorder_point: material.reorder_point ?? null,
            min_stock_level: material.min_stock_level ?? null,
            image_url: material.image_url || "",
            aliases: material.aliases || [],
          };
          return { ...prev, materials: [...prev.materials, saved] };
        });
        return saved;
      },
      deleteMaterial: (id) =>
        commit((prev) => ({
          ...prev,
          materials: prev.materials.filter((row) => row.id !== id),
          inventory: prev.inventory.filter((row) => row.material_id !== id),
        })),
      applyAction: (action) => {
        const qty = Number(action.quantity);
        if (!action.materialId) return { ok: false, error: "Select a material." };
        if (!qty || qty <= 0) return { ok: false, error: "Quantity must be greater than zero." };

        let error: string | null = null;
        commit((prev) => {
          let inventory = prev.inventory.map((row) => ({ ...row }));
          if (action.type === "add") {
            if (!action.toLocationId) {
              error = "Destination location required.";
              return prev;
            }
            inventory = bumpQty(inventory, action.materialId, action.toLocationId, qty);
          } else if (action.type === "use" || action.type === "shrink") {
            if (!action.fromLocationId) {
              error = "Source location required.";
              return prev;
            }
            const have = inventory.find(
              (row) =>
                row.material_id === action.materialId &&
                row.location_id === action.fromLocationId,
            )?.quantity ?? 0;
            if (have < qty) {
              error = `Only ${have} on hand at that location.`;
              return prev;
            }
            inventory = bumpQty(inventory, action.materialId, action.fromLocationId, -qty);
          } else if (action.type === "transfer") {
            if (!action.fromLocationId || !action.toLocationId) {
              error = "Both source and destination required.";
              return prev;
            }
            if (action.fromLocationId === action.toLocationId) {
              error = "Pick two different locations.";
              return prev;
            }
            const have = inventory.find(
              (row) =>
                row.material_id === action.materialId &&
                row.location_id === action.fromLocationId,
            )?.quantity ?? 0;
            if (have < qty) {
              error = `Only ${have} on hand at the source location.`;
              return prev;
            }
            inventory = bumpQty(inventory, action.materialId, action.fromLocationId, -qty);
            inventory = bumpQty(inventory, action.materialId, action.toLocationId, qty);
          } else if (action.type === "adjust") {
            const locationId = action.toLocationId || action.fromLocationId;
            if (!locationId) {
              error = "Location required.";
              return prev;
            }
            inventory = inventory.filter(
              (row) =>
                !(row.material_id === action.materialId && row.location_id === locationId),
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
                created_by: "you",
              },
              ...prev.transactions,
            ],
          };
        });
        return error ? { ok: false, error } : { ok: true };
      },
      deleteTransaction: (id) =>
        commit((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((row) => row.id !== id),
        })),
      createPurchaseOrder: (po) =>
        commit((prev) => ({
          ...prev,
          purchaseOrders: [
            {
              ...po,
              id: uid("po"),
              status: po.status || "ordered",
              created_at: new Date().toISOString(),
            },
            ...prev.purchaseOrders,
          ],
        })),
      receivePurchaseOrder: (poId, locationId, receipts) => {
        let error: string | null = null;
        commit((prev) => {
          const po = prev.purchaseOrders.find((row) => row.id === poId);
          if (!po) {
            error = "Purchase order not found.";
            return prev;
          }
          let inventory = prev.inventory.map((row) => ({ ...row }));
          const lines = po.lines.map((line) => ({ ...line }));
          const txs = [...prev.transactions];
          for (const receipt of receipts) {
            if (!receipt.quantity) continue;
            const line = lines.find((row) => row.material_id === receipt.material_id);
            if (!line) continue;
            const remaining = line.expected_quantity - line.received_quantity;
            const qty = Math.min(receipt.quantity, Math.max(0, remaining));
            if (qty <= 0) continue;
            line.received_quantity += qty;
            inventory = bumpQty(inventory, receipt.material_id, locationId, qty);
            txs.unshift({
              id: uid("tx"),
              type: "add",
              material_id: receipt.material_id,
              quantity: qty,
              to_location_id: locationId,
              notes: po.po_number,
              created_at: new Date().toISOString(),
              created_by: "you",
            });
          }
          const allReceived = lines.every(
            (line) => line.received_quantity >= line.expected_quantity,
          );
          const anyReceived = lines.some((line) => line.received_quantity > 0);
          const status = allReceived ? "received" : anyReceived ? "partial" : po.status;
          return {
            ...prev,
            inventory,
            transactions: txs,
            purchaseOrders: prev.purchaseOrders.map((row) =>
              row.id === poId ? { ...row, lines, status } : row,
            ),
          };
        });
        return error ? { ok: false, error } : { ok: true };
      },
      setPurchaseOrderStatus: (poId, status) =>
        commit((prev) => ({
          ...prev,
          purchaseOrders: prev.purchaseOrders.map((row) =>
            row.id === poId ? { ...row, status } : row,
          ),
        })),
      createAccessCode: ({ label, type, days }) => {
        const created: AccessCode = {
          id: uid("ac"),
          code: `${(label || "CODE").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || "STOCK"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          type,
          label,
          expires_at:
            type === "trial"
              ? new Date(Date.now() + (days || 14) * 86400000).toISOString()
              : null,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        commit((prev) => ({
          ...prev,
          accessCodes: [created, ...prev.accessCodes],
        }));
        return created;
      },
      toggleAccessCode: (id) =>
        commit((prev) => ({
          ...prev,
          accessCodes: prev.accessCodes.map((row) =>
            row.id === id ? { ...row, is_active: !row.is_active } : row,
          ),
        })),
    }),
    [commit, hydrated, state],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
