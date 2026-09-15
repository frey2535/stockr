"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  AccessCode,
  Account,
  InventoryAction,
  Location,
  Material,
  Project,
  PurchaseOrder,
  Settings,
  Tool,
  WorkspaceShell,
} from "./types";
import { invalidateApiCache } from "./api-cache";
import { createEmptyState } from "./seed";
import type { StoreCommand } from "./mutations";

type CommandResult = {
  ok: boolean;
  error?: string;
  created?: Material | AccessCode | Tool;
};

type StoreApi = {
  workspace: WorkspaceShell;
  account: Account | null;
  hydrated: boolean;
  refreshWorkspace: () => Promise<void>;
  resetDemo: () => Promise<CommandResult>;
  updateSettings: (patch: Partial<Settings>) => Promise<CommandResult>;
  upsertLocation: (location: Partial<Location> & { id?: string }) => Promise<CommandResult>;
  deleteLocation: (id: string) => Promise<CommandResult>;
  upsertMaterial: (
    material: Partial<Material> & { id?: string },
  ) => Promise<{ ok: true; material: Material } | { ok: false; error: string }>;
  upsertMaterials: (
    materials: Array<Partial<Material> & { id?: string }>,
  ) => Promise<CommandResult>;
  deleteMaterial: (id: string) => Promise<CommandResult>;
  applyAction: (action: InventoryAction) => Promise<{ ok: true } | { ok: false; error: string }>;
  applyBulkActions: (
    actions: InventoryAction[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteTransaction: (id: string) => Promise<CommandResult>;
  createPurchaseOrder: (
    po: Omit<PurchaseOrder, "id" | "created_at" | "status"> & { status?: PurchaseOrder["status"] },
  ) => Promise<CommandResult>;
  receivePurchaseOrder: (
    poId: string,
    locationId: string,
    receipts: { material_id: string; quantity: number }[],
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  setPurchaseOrderStatus: (poId: string, status: PurchaseOrder["status"]) => Promise<CommandResult>;
  deletePurchaseOrder: (poId: string) => Promise<CommandResult>;
  upsertTool: (
    tool: Partial<Tool> & { id?: string },
  ) => Promise<{ ok: true; tool: Tool } | { ok: false; error: string }>;
  deleteTool: (id: string) => Promise<CommandResult>;
  replaceProjects: (projects: Project[]) => Promise<CommandResult>;
  createAccessCode: (input: {
    label: string;
    type: AccessCode["type"];
    days?: number;
  }) => Promise<{ ok: true; code: AccessCode } | { ok: false; error: string }>;
  toggleAccessCode: (id: string) => Promise<CommandResult>;
  setAccount: (account: Account | null) => void;
  logout: () => Promise<void>;
};

const StoreContext = createContext<StoreApi | null>(null);

function emptyWorkspace(name = "Stockr"): WorkspaceShell {
  const empty = createEmptyState(name);
  return {
    settings: empty.settings,
    locations: empty.locations,
    projects: empty.projects,
    accessCodes: empty.accessCodes,
    tools: empty.tools,
    counts: {
      locations: empty.locations.length,
      materials: 0,
      inventoryRows: 0,
      transactions: 0,
      purchaseOrders: 0,
      tools: 0,
    },
  };
}

export function StoreProvider({
  children,
  initialWorkspace,
  initialAccount,
}: {
  children: React.ReactNode;
  initialWorkspace: WorkspaceShell;
  initialAccount: Account;
}) {
  const [workspace, setWorkspace] = useState<WorkspaceShell>(initialWorkspace);
  const [account, setAccount] = useState<Account | null>(initialAccount);

  const refreshWorkspace = useCallback(async () => {
    const response = await fetch("/api/workspace");
    const data = (await response.json().catch(() => null)) as {
      workspace?: WorkspaceShell;
      account?: Account;
    } | null;
    if (data?.workspace) setWorkspace(data.workspace);
    if (data?.account) setAccount(data.account);
  }, []);

  const send = useCallback(async (command: StoreCommand): Promise<CommandResult> => {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const data = (await response.json().catch(() => null)) as {
      workspace?: WorkspaceShell;
      account?: Account;
      error?: string;
      created?: Material | AccessCode | Tool;
    } | null;
    if (response.status === 401) {
      window.location.href = "/login";
      return { ok: false, error: "Sign in required." };
    }
    if (data?.workspace) setWorkspace(data.workspace);
    if (data?.account) setAccount(data.account);
    if (!response.ok || data?.error) {
      return { ok: false, error: data?.error || "Could not save that change." };
    }
    invalidateApiCache("/api/");
    return { ok: true, created: data?.created };
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      workspace,
      account,
      hydrated: true,
      refreshWorkspace,
      setAccount,
      resetDemo: () => send({ type: "resetDemo" }),
      updateSettings: (patch) => send({ type: "updateSettings", patch }),
      upsertLocation: (location) => send({ type: "upsertLocation", location }),
      deleteLocation: (id) => send({ type: "deleteLocation", id }),
      upsertMaterial: async (material) => {
        const result = await send({ type: "upsertMaterial", material });
        if (!result.ok || !result.created || !("unit" in result.created)) {
          return { ok: false, error: result.error || "Could not save material." };
        }
        return { ok: true, material: result.created };
      },
      upsertMaterials: (materials) => send({ type: "upsertMaterials", materials }),
      deleteMaterial: (id) => send({ type: "deleteMaterial", id }),
      applyAction: async (action) => {
        const result = await send({ type: "applyAction", action });
        return result.ok ? { ok: true } : { ok: false, error: result.error || "Could not update inventory." };
      },
      applyBulkActions: async (actions) => {
        const result = await send({ type: "applyBulkActions", actions });
        return result.ok ? { ok: true } : { ok: false, error: result.error || "Could not apply bulk update." };
      },
      deleteTransaction: (id) => send({ type: "deleteTransaction", id }),
      createPurchaseOrder: (po) => send({ type: "createPurchaseOrder", po }),
      receivePurchaseOrder: async (poId, locationId, receipts) => {
        const result = await send({ type: "receivePurchaseOrder", poId, locationId, receipts });
        return result.ok ? { ok: true } : { ok: false, error: result.error || "Could not receive purchase order." };
      },
      setPurchaseOrderStatus: (poId, status) => send({ type: "setPurchaseOrderStatus", poId, status }),
      deletePurchaseOrder: (poId) => send({ type: "deletePurchaseOrder", poId }),
      upsertTool: async (tool) => {
        const result = await send({ type: "upsertTool", tool });
        if (!result.ok || !result.created || !("assigned_location_id" in result.created)) {
          return { ok: false, error: result.error || "Could not save tool." };
        }
        const saved = result.created;
        setWorkspace((prev) => {
          const current = prev.tools || [];
          const next = current.some((row) => row.id === saved.id)
            ? current.map((row) => (row.id === saved.id ? saved : row))
            : [...current, saved];
          return { ...prev, tools: next, counts: { ...prev.counts, tools: next.length } };
        });
        return { ok: true, tool: saved };
      },
      deleteTool: async (id) => {
        const result = await send({ type: "deleteTool", id });
        if (result.ok) {
          setWorkspace((prev) => {
            const next = (prev.tools || []).filter((row) => row.id !== id);
            return { ...prev, tools: next, counts: { ...prev.counts, tools: next.length } };
          });
        }
        return result;
      },
      replaceProjects: (projects) => send({ type: "replaceProjects", projects }),
      createAccessCode: async ({ label, type, days }) => {
        const result = await send({ type: "createAccessCode", label, codeType: type, days });
        if (!result.ok || !result.created || !("code" in result.created)) {
          return { ok: false, error: result.error || "Could not create invite code." };
        }
        return { ok: true, code: result.created };
      },
      toggleAccessCode: (id) => send({ type: "toggleAccessCode", id }),
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/";
      },
    }),
    [account, refreshWorkspace, send, workspace],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function MarketingStoreFallback({ children }: { children: React.ReactNode }) {
  const empty = emptyWorkspace("Stockr");
  return (
    <StoreContext.Provider
      value={{
        workspace: empty,
        account: null,
        hydrated: true,
        refreshWorkspace: async () => undefined,
        resetDemo: async () => ({ ok: false }),
        updateSettings: async () => ({ ok: false }),
        upsertLocation: async () => ({ ok: false }),
        deleteLocation: async () => ({ ok: false }),
        upsertMaterial: async () => ({ ok: false, error: "Sign in required." }),
        upsertMaterials: async () => ({ ok: false }),
        deleteMaterial: async () => ({ ok: false }),
        applyAction: async () => ({ ok: false, error: "Sign in required." }),
        applyBulkActions: async () => ({ ok: false, error: "Sign in required." }),
        deleteTransaction: async () => ({ ok: false }),
        createPurchaseOrder: async () => ({ ok: false }),
        receivePurchaseOrder: async () => ({ ok: false, error: "Sign in required." }),
        setPurchaseOrderStatus: async () => ({ ok: false }),
        deletePurchaseOrder: async () => ({ ok: false }),
        upsertTool: async () => ({ ok: false, error: "Sign in required." }),
        deleteTool: async () => ({ ok: false }),
        replaceProjects: async () => ({ ok: false }),
        createAccessCode: async () => ({ ok: false, error: "Sign in required." }),
        toggleAccessCode: async () => ({ ok: false }),
        setAccount: () => undefined,
        logout: async () => undefined,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
