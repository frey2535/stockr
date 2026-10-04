import { isSupabaseConfigured } from "./db-config";
import type { Account, CompanyList, MemberRole, PlanId, PlatformCompany, StoreState } from "./types";

export { dataBackend, isSupabaseConfigured } from "./db-config";

type Adapter = {
  getCompanyState: (companyId: string) => StoreState | Promise<StoreState>;
  setCompanyState: (companyId: string, state: StoreState) => void | Promise<void>;
  getAccount: (
    userId: string,
    companyId: string,
    options?: { members?: boolean },
  ) => Account | null | Promise<Account | null>;
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
  setPlayPurchase?: (
    companyId: string,
    input: { productId: string; purchaseToken: string; expiresAt?: string | null },
  ) => void | Promise<void>;
  updateCompanyName: (companyId: string, name: string) => void | Promise<void>;
  seedDemoTenant?: () => void | Promise<void>;
  ensurePlatformOwner?: () => void | Promise<void>;
  listCompanies: (opts?: { q?: string; limit?: number; offset?: number }) => CompanyList | Promise<CompanyList>;
  getPlatformCompany?: (id: string) => PlatformCompany | null | Promise<PlatformCompany | null>;
  ensureCompanyMembership: (
    userId: string,
    companyId: string,
    role: MemberRole,
  ) => void | Promise<void>;
  createPasswordReset?: (email: string) => Promise<{ token: string; email: string; stored: boolean } | null>;
  consumePasswordReset?: (token: string, password: string) => Promise<{ ok?: true; error?: string }>;
  deleteCompanyWorkspace?: (companyId: string, actorUserId: string) => Promise<void>;
  joinCompanyByInvite?: (
    userId: string,
    inviteCode: string,
  ) => { companyId: string } | { error: string } | Promise<{ companyId: string } | { error: string }>;
  resolveBuildrSsoIdentity: (
    email: string,
    buildrCompanyId: string,
  ) =>
    | { userId: string; companyId: string; role: MemberRole }
    | null
    | Promise<{ userId: string; companyId: string; role: MemberRole } | null>;
  ensureBuildrSsoIdentity?: (input: {
    email: string;
    name?: string;
    buildrCompanyId: string;
    companyName?: string;
    passwordHash?: string;
    role?: string;
  }) =>
    | { userId: string; companyId: string; role: MemberRole }
    | null
    | Promise<{ userId: string; companyId: string; role: MemberRole } | null>;
};

let adapterPromise: Promise<Adapter> | null = null;

function loadAdapter(): Promise<Adapter> {
  if (!adapterPromise) {
    if (
      (process.env.VERCEL ||
        process.env.CF_PAGES ||
        process.env.OPEN_NEXT_CLOUDFLARE ||
        process.env.CLOUDFLARE_ACCOUNT_ID) &&
      !isSupabaseConfigured()
    ) {
      throw new Error(
        "Stockr in production needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    adapterPromise = isSupabaseConfigured()
      ? import("./db-supabase").then(async (mod) => {
          try {
            await mod.seedDemoTenant();
            await mod.ensurePlatformOwner();
          } catch (error) {
            console.error(
              "Stockr could not seed Supabase. Run supabase/schema.sql in the SQL editor, then restart.",
              error,
            );
          }
          return mod as Adapter;
        })
      : import("./db-sqlite").then((mod) => mod as Adapter);
  }
  return adapterPromise;
}

export async function getCompanyState(companyId: string) {
  return (await loadAdapter()).getCompanyState(companyId);
}

export async function setCompanyState(companyId: string, state: StoreState) {
  return (await loadAdapter()).setCompanyState(companyId, state);
}

export async function getAccount(userId: string, companyId: string, options?: { members?: boolean }) {
  return (await loadAdapter()).getAccount(userId, companyId, options);
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

export async function setPlayPurchase(
  companyId: string,
  input: { productId: string; purchaseToken: string; expiresAt?: string | null },
) {
  const adapter = await loadAdapter();
  if (!adapter.setPlayPurchase) return;
  return adapter.setPlayPurchase(companyId, input);
}

export async function updateCompanyName(companyId: string, name: string) {
  return (await loadAdapter()).updateCompanyName(companyId, name);
}

export async function listCompanies(opts?: { q?: string; limit?: number; offset?: number }) {
  return (await loadAdapter()).listCompanies(opts);
}

export async function getPlatformCompany(id: string) {
  const adapter = await loadAdapter();
  if (!adapter.getPlatformCompany) {
    const listed = await adapter.listCompanies({ q: "", limit: 100, offset: 0 });
    return listed.rows.find((row) => row.id === id) || null;
  }
  return adapter.getPlatformCompany(id);
}

export async function ensureCompanyMembership(userId: string, companyId: string, role: MemberRole) {
  return (await loadAdapter()).ensureCompanyMembership(userId, companyId, role);
}

export async function joinCompanyByInvite(userId: string, inviteCode: string) {
  const adapter = await loadAdapter();
  if (!adapter.joinCompanyByInvite) return { error: "Invite join is not available." };
  return adapter.joinCompanyByInvite(userId, inviteCode);
}


/**
 * Resolve an existing standalone Stockr account from a validated Buildr SSO claim.
 * This never creates a Stockr user/company. Standalone purchase/account setup remains
 * authoritative; Buildr only provides a seamless launch into an already-owned workspace.
 */
export async function resolveBuildrSsoIdentity(email: string, buildrCompanyId: string) {
  return (await loadAdapter()).resolveBuildrSsoIdentity(email, buildrCompanyId);
}

export async function ensureBuildrSsoIdentity(input: {
  email: string;
  name?: string;
  buildrCompanyId: string;
  companyName?: string;
  passwordHash?: string;
  role?: string;
}) {
  const adapter = await loadAdapter();
  if (adapter.ensureBuildrSsoIdentity) {
    return adapter.ensureBuildrSsoIdentity(input);
  }
  return adapter.resolveBuildrSsoIdentity(input.email, input.buildrCompanyId);
}

export async function createPasswordReset(email: string) {
  const adapter = await loadAdapter();
  if (!adapter.createPasswordReset) return null;
  return adapter.createPasswordReset(email);
}

export async function consumePasswordReset(token: string, password: string) {
  const adapter = await loadAdapter();
  if (!adapter.consumePasswordReset) return { error: "Password reset is not available." };
  return adapter.consumePasswordReset(token, password);
}

export async function deleteCompanyWorkspace(companyId: string, actorUserId: string) {
  const adapter = await loadAdapter();
  if (!adapter.deleteCompanyWorkspace) throw new Error("Workspace deletion is not available.");
  return adapter.deleteCompanyWorkspace(companyId, actorUserId);
}
