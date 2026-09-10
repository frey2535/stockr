import { isSupabaseConfigured } from "./db-config";
import type { Account, PlanId, StoreState } from "./types";

export { dataBackend, isSupabaseConfigured } from "./db-config";

type Adapter = {
  getCompanyState: (companyId: string) => StoreState | Promise<StoreState>;
  setCompanyState: (companyId: string, state: StoreState) => void | Promise<void>;
  getAccount: (userId: string, companyId: string) => Account | null | Promise<Account | null>;
  createSession: (userId: string, companyId: string) => { id: string; expiresAt: string } | Promise<{ id: string; expiresAt: string }>;
  getSession: (id: string) => { id: string; user_id: string; company_id: string; expires_at: string } | null | Promise<{ id: string; user_id: string; company_id: string; expires_at: string } | null>;
  deleteSession: (id: string) => void | Promise<void>;
  createCompanyWithOwner: (input: {
    email: string;
    name: string;
    password: string;
    companyName: string;
    inviteCode?: string;
  }) =>
    | { error: string }
    | { userId: string; companyId: string }
    | Promise<{ error: string } | { userId: string; companyId: string }>;
  verifyPassword: (
    email: string,
    password: string,
  ) => { userId: string; companyId: string } | null | Promise<{ userId: string; companyId: string } | null>;
  setCompanyPlan: (companyId: string, plan: PlanId) => void | Promise<void>;
  updateCompanyName: (companyId: string, name: string) => void | Promise<void>;
  seedDemoTenant?: () => void | Promise<void>;
};

let adapterPromise: Promise<Adapter> | null = null;

function loadAdapter() {
  if (!adapterPromise) {
    adapterPromise = isSupabaseConfigured()
      ? import("./db-supabase").then(async (mod) => {
          try {
            await mod.seedDemoTenant();
          } catch (error) {
            console.error(
              "Stockr could not seed Supabase. Run supabase/schema.sql in the SQL editor, then restart.",
              error,
            );
          }
          return mod;
        })
      : import("./db-sqlite");
  }
  return adapterPromise;
}

export async function getCompanyState(companyId: string) {
  return (await loadAdapter()).getCompanyState(companyId);
}

export async function setCompanyState(companyId: string, state: StoreState) {
  return (await loadAdapter()).setCompanyState(companyId, state);
}

export async function getAccount(userId: string, companyId: string) {
  return (await loadAdapter()).getAccount(userId, companyId);
}

export async function createSession(userId: string, companyId: string) {
  return (await loadAdapter()).createSession(userId, companyId);
}

export async function getSession(id: string) {
  return (await loadAdapter()).getSession(id);
}

export async function deleteSession(id: string) {
  return (await loadAdapter()).deleteSession(id);
}

export async function createCompanyWithOwner(input: {
  email: string;
  name: string;
  password: string;
  companyName: string;
  inviteCode?: string;
}) {
  return (await loadAdapter()).createCompanyWithOwner(input);
}

export async function verifyPassword(email: string, password: string) {
  return (await loadAdapter()).verifyPassword(email, password);
}

export async function setCompanyPlan(companyId: string, plan: PlanId) {
  return (await loadAdapter()).setCompanyPlan(companyId, plan);
}

export async function updateCompanyName(companyId: string, name: string) {
  return (await loadAdapter()).updateCompanyName(companyId, name);
}
