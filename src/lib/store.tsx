"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type {
  AccessCode,
  Account,
  InventoryAction,
  Location,
  Material,
  PurchaseOrder,
  Settings,
  StoreState,
} from "./types";
import { createEmptyState } from "./seed";
import type { StoreCommand } from "./mutations";

type CommandResult = {
  ok: boolean;
  error?: string;
  created?: Material | AccessCode;
};

type StoreApi = {
  state: StoreState;
  account: Account | null;
  hydrated: boolean;
  resetDemo: () => Promise<CommandResult>;
  updateSettings: (patch: Partial<Settings>) => Promise<CommandResult>;
  upsertLocation: (location: Partial<Location> & { id?: string }) => Promise<CommandResult>;
  deleteLocation: (id: string) => Promise<CommandResult>;
  upsertMaterial: (
    material: Partial<Material> & { id?: string },
  ) => Promise<{ ok: true; material: Material } | { ok: false; error: string }>;
  deleteMaterial: (id: string) => Promise<CommandResult>;
  applyAction: (action: InventoryAction) => Promise<{ ok: true } | { ok: false; error: string }>;
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

export function StoreProvider({
  children,
  initialState,
  initialAccount,
}: {
  children: React.ReactNode;
  initialState: StoreState;
  initialAccount: Account;
}) {
  const [state, setState] = useState<StoreState>(initialState);
  const [account, setAccount] = useState<Account | null>(initialAccount);

  const send = useCallback(async (command: StoreCommand): Promise<CommandResult> => {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const data = (await response.json().catch(() => null)) as {
      state?: StoreState;
      account?: Account;
      error?: string;
      created?: Material | AccessCode;
    } | null;
    if (response.status === 401) {
      window.location.href = "/login";
      return { ok: false, error: "Sign in required." };
    }
    if (data?.state) {
      setState(data.state);
    }
    if (data?.account) setAccount(data.account);
    if (!response.ok || data?.error) {
      return { ok: false, error: data?.error || "Could not save that change." };
    }
    return { ok: true, created: data?.created };
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      account,
      hydrated: true,
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
      deleteMaterial: (id) => send({ type: "deleteMaterial", id }),
      applyAction: async (action) => {
        const result = await send({ type: "applyAction", action });
        return result.ok ? { ok: true } : { ok: false, error: result.error || "Could not update inventory." };
      },
      deleteTransaction: (id) => send({ type: "deleteTransaction", id }),
      createPurchaseOrder: (po) => send({ type: "createPurchaseOrder", po }),
      receivePurchaseOrder: async (poId, locationId, receipts) => {
        const result = await send({ type: "receivePurchaseOrder", poId, locationId, receipts });
        return result.ok ? { ok: true } : { ok: false, error: result.error || "Could not receive purchase order." };
      },
      setPurchaseOrderStatus: (poId, status) => send({ type: "setPurchaseOrderStatus", poId, status }),
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
    [account, send, state],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function MarketingStoreFallback({ children }: { children: React.ReactNode }) {
  const empty = createEmptyState("Stockr");
  return (
    <StoreContext.Provider
      value={{
        state: empty,
        account: null,
        hydrated: true,
        resetDemo: async () => ({ ok: false }),
        updateSettings: async () => ({ ok: false }),
        upsertLocation: async () => ({ ok: false }),
        deleteLocation: async () => ({ ok: false }),
        upsertMaterial: async () => ({ ok: false, error: "Sign in required." }),
        deleteMaterial: async () => ({ ok: false }),
        applyAction: async () => ({ ok: false, error: "Sign in required." }),
        deleteTransaction: async () => ({ ok: false }),
        createPurchaseOrder: async () => ({ ok: false }),
        receivePurchaseOrder: async () => ({ ok: false, error: "Sign in required." }),
        setPurchaseOrderStatus: async () => ({ ok: false }),
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
