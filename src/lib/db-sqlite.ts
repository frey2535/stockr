import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { createEmptyState, createSeedState, normalizeStoreState } from "./seed";
import { encodeStateForPersist } from "./persist-state";
import { planLimitError } from "./plans";
import {
  PLATFORM_OWNER_COMPANY_ID,
  PLATFORM_OWNER_COMPANY_NAME,
  isPlatformOwner,
  seededOwnersToProvision,
} from "./platform";
import { demoWorkspaceEnabled } from "./production";
import { companyListQuery, inviteJoinError, pickLoginCompany } from "./tenants";
import type {
  Account,
  AccountWorkspace,
  CompanyList,
  MemberRole,
  PlanId,
  PlatformCompany,
  StoreState,
  TeamMember,
} from "./types";
import { uid } from "./id";
import { pickBuildrSsoCompany, shouldPersistBuildrLink } from "./buildr-sso-identity";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "stockr.db");

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  plan_status: "trialing" | "active" | "past_due";
  created_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  company_id: string;
  expires_at: string;
};

function openDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      plan_status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memberships (
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (user_id, company_id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS company_state (
      company_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

const globalForDb = globalThis as unknown as { stockrDb?: DatabaseSync };
export const db = globalForDb.stockrDb ?? openDb();
if (process.env.NODE_ENV !== "production") globalForDb.stockrDb = db;

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
  return `${base}-${uid("co").slice(-6)}`;
}

export function getCompanyState(companyId: string): StoreState {
  const row = db
    .prepare("SELECT payload FROM company_state WHERE company_id = ?")
    .get(companyId) as { payload: string } | undefined;
  if (!row) return createEmptyState("New company");
  return normalizeStoreState(plain(JSON.parse(row.payload) as StoreState));
}

export function setCompanyState(companyId: string, state: StoreState) {
  const next = encodeStateForPersist(normalizeStoreState(state));
  db.prepare(
    `INSERT INTO company_state (company_id, payload) VALUES (?, ?)
     ON CONFLICT(company_id) DO UPDATE SET payload = excluded.payload`,
  ).run(companyId, JSON.stringify(next));
}

export function getUserByEmail(email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as
    | UserRow
    | undefined;
}

export function getUserById(id: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getCompany(id: string) {
  return db.prepare("SELECT * FROM companies WHERE id = ?").get(id) as CompanyRow | undefined;
}

export function listMembers(companyId: string): TeamMember[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.name, m.role
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.company_id = ?`,
    )
    .all(companyId) as { id: string; email: string; name: string; role: MemberRole }[];
  return plain(rows);
}

export function getAccount(
  userId: string,
  companyId: string,
  options?: { members?: boolean },
): Account | null {
  const user = getUserById(userId);
  const company = getCompany(companyId);
  const membership = db
    .prepare("SELECT role FROM memberships WHERE user_id = ? AND company_id = ?")
    .get(userId, companyId) as { role: MemberRole } | undefined;
  if (!user || !company || !membership) return null;
  return plain({
    user: { id: user.id, email: user.email, name: user.name },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      plan: company.plan,
      planStatus: company.plan_status,
    },
    role: membership.role,
    members: options?.members === false ? [] : listMembers(companyId),
    workspaces: listUserCompanies(userId),
    dataBackend: "sqlite",
    platformOwner: isPlatformOwner(user.email),
  });
}

export function createSession(userId: string, companyId: string) {
  const id = uid("ses");
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, company_id, expires_at) VALUES (?, ?, ?, ?)").run(
    id,
    userId,
    companyId,
    expires,
  );
  return { id, expiresAt: expires };
}

export function getSession(id: string) {
  const row = db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }
  return row;
}

export function deleteSession(id: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
}

export function listUserCompanies(userId: string): AccountWorkspace[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.slug, m.role
       FROM memberships m JOIN companies c ON c.id = m.company_id
       WHERE m.user_id = ?
       ORDER BY c.name`,
    )
    .all(userId) as { id: string; name: string; slug: string; role: MemberRole }[];
  return plain(rows);
}

function resolveInviteCompany(inviteCode: string) {
  const companies = db.prepare("SELECT id FROM companies").all() as { id: string }[];
  for (const company of companies) {
    const state = getCompanyState(company.id);
    const invite = state.accessCodes.find(
      (code) =>
        code.is_active &&
        code.code.toLowerCase() === inviteCode.trim().toLowerCase() &&
        (!code.expires_at || new Date(code.expires_at) > new Date()),
    );
    if (!invite) continue;
    const companyRow = getCompany(company.id);
    if (companyRow) return { company: companyRow };
  }
  return { error: "Invite code is invalid or expired." };
}

export function joinCompanyByInvite(userId: string, inviteCode: string) {
  const resolved = resolveInviteCompany(inviteCode);
  if ("error" in resolved) return resolved;
  const company = resolved.company;
  const alreadyMember = Boolean(
    db.prepare("SELECT role FROM memberships WHERE user_id = ? AND company_id = ?").get(userId, company.id),
  );
  const seatError = alreadyMember
    ? null
    : planLimitError(company.plan, {}, "seat", listMembers(company.id).length);
  if (seatError) return { error: seatError };
  if (!alreadyMember) {
    db.prepare("INSERT INTO memberships (user_id, company_id, role) VALUES (?, ?, ?)").run(
      userId,
      company.id,
      "member",
    );
  }
  return { companyId: company.id };
}

export function createCompanyWithOwner(input: {
  email: string;
  name: string;
  password: string;
  companyName: string;
  inviteCode?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = getUserByEmail(email);
  if (existing && !input.inviteCode) return { error: "An account with that email already exists." };

  if (input.inviteCode) {
    if (existing) {
      const joinError = inviteJoinError({
        existingUser: true,
        passwordMatches: bcrypt.compareSync(input.password, existing.password_hash),
        alreadyMember: false,
        seatError: null,
      });
      if (joinError) return { error: joinError };
      const joined = joinCompanyByInvite(existing.id, input.inviteCode);
      if (!("companyId" in joined)) return joined;
      return { userId: existing.id, companyId: joined.companyId };
    }
    const resolved = resolveInviteCompany(input.inviteCode);
    if ("error" in resolved) return resolved;
    const seatError = planLimitError(resolved.company.plan, {}, "seat", listMembers(resolved.company.id).length);
    if (seatError) return { error: seatError };
    const userId = uid("usr");
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, email, input.name.trim() || email.split("@")[0], bcrypt.hashSync(input.password, 10), new Date().toISOString());
    const joined = joinCompanyByInvite(userId, input.inviteCode);
    if (!("companyId" in joined)) return joined;
    return { userId, companyId: joined.companyId };
  }

  const userId = uid("usr");
  const companyId = uid("co");
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    userId,
    email,
    input.name.trim() || email.split("@")[0],
    bcrypt.hashSync(input.password, 10),
    now,
  );
  db.prepare(
    "INSERT INTO companies (id, name, slug, plan, plan_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(companyId, input.companyName.trim() || "My company", slugify(input.companyName), "starter", "trialing", now);
  db.prepare("INSERT INTO memberships (user_id, company_id, role) VALUES (?, ?, ?)").run(
    userId,
    companyId,
    "owner",
  );
  setCompanyState(companyId, createEmptyState(input.companyName.trim() || "My company"));
  return { userId, companyId };
}

export function verifyPassword(email: string, password: string) {
  const user = getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
  const memberships = db
    .prepare("SELECT company_id FROM memberships WHERE user_id = ?")
    .all(user.id) as { company_id: string }[];
  if (memberships.length === 0) return null;
  const last = db
    .prepare("SELECT company_id FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1")
    .get(user.id) as { company_id: string } | undefined;
  return {
    userId: user.id,
    companyId: pickLoginCompany({
      companyIds: memberships.map((row) => row.company_id),
      lastCompanyId: last?.company_id,
      preferredCompanyId: isPlatformOwner(user.email) ? PLATFORM_OWNER_COMPANY_ID : "",
    }),
  };
}

function mapPlatformCompany(company: CompanyRow): PlatformCompany {
  const count = db
    .prepare("SELECT COUNT(*) AS n FROM memberships WHERE company_id = ?")
    .get(company.id) as { n: number };
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    plan: company.plan,
    planStatus: company.plan_status,
    memberCount: count.n,
  };
}

export function getPlatformCompany(id: string): PlatformCompany | null {
  const company = getCompany(id);
  return company ? mapPlatformCompany(company) : null;
}

export function listCompanies(opts?: { q?: string; limit?: number; offset?: number }): CompanyList {
  const { q, limit, offset } = companyListQuery(opts || {});
  const like = `%${q}%`;
  const companies = (
    q
      ? db
          .prepare(
            "SELECT id, name, slug, plan, plan_status, created_at FROM companies WHERE name LIKE ? OR slug LIKE ? ORDER BY name LIMIT ? OFFSET ?",
          )
          .all(like, like, limit, offset)
      : db
          .prepare("SELECT id, name, slug, plan, plan_status, created_at FROM companies ORDER BY name LIMIT ? OFFSET ?")
          .all(limit, offset)
  ) as CompanyRow[];
  const total = (
    q
      ? (db.prepare("SELECT COUNT(*) AS n FROM companies WHERE name LIKE ? OR slug LIKE ?").get(like, like) as {
          n: number;
        })
      : (db.prepare("SELECT COUNT(*) AS n FROM companies").get() as { n: number })
  ).n;
  return { rows: companies.map(mapPlatformCompany), total };
}

export function ensureCompanyMembership(userId: string, companyId: string, role: MemberRole) {
  const existing = db
    .prepare("SELECT role FROM memberships WHERE user_id = ? AND company_id = ?")
    .get(userId, companyId) as { role: string } | undefined;
  if (existing) return;
  db.prepare("INSERT INTO memberships (user_id, company_id, role) VALUES (?, ?, ?)").run(
    userId,
    companyId,
    role,
  );
}


export function resolveBuildrSsoIdentity(email: string, buildrCompanyId: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedBuildrCompanyId = String(buildrCompanyId || "").trim();
  if (!normalizedEmail || !normalizedBuildrCompanyId) return null;

  const user = getUserByEmail(normalizedEmail);
  if (!user) return null;

  const memberships = db
    .prepare("SELECT company_id, role FROM memberships WHERE user_id = ?")
    .all(user.id) as { company_id: string; role: MemberRole }[];
  const last = db
    .prepare("SELECT company_id FROM sessions WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1")
    .get(user.id) as { company_id: string } | undefined;
  const candidates = memberships.map((row) => {
    const settings = getCompanyState(row.company_id).settings;
    return {
      companyId: row.company_id,
      role: row.role,
      buildrLinked: settings.buildr_linked === true,
      buildrCompanyId: settings.buildr_company_id,
    };
  });
  const picked = pickBuildrSsoCompany(candidates, normalizedBuildrCompanyId, last?.company_id || "");
  if (!picked) return null;

  if (shouldPersistBuildrLink(picked, normalizedBuildrCompanyId, candidates)) {
    const state = getCompanyState(picked.companyId);
    if (
      state.settings.buildr_linked !== true ||
      String(state.settings.buildr_company_id || "").trim() !== normalizedBuildrCompanyId
    ) {
      setCompanyState(picked.companyId, {
        ...state,
        settings: {
          ...state.settings,
          buildr_linked: true,
          buildr_company_id: normalizedBuildrCompanyId,
        },
      });
    }
  }

  return { userId: user.id, companyId: picked.companyId, role: picked.role as MemberRole };
}


export type BuildrSsoBootstrapInput = {
  email: string;
  name?: string;
  buildrCompanyId: string;
  companyName?: string;
  passwordHash?: string;
  role?: string;
};

function mapBuildrRole(role: string | undefined): MemberRole {
  const value = String(role || "").trim().toLowerCase();
  if (value === "owner") return "owner";
  if (value === "admin") return "admin";
  return "member";
}

export function ensureBuildrSsoIdentity(input: BuildrSsoBootstrapInput) {
  const email = String(input.email || "").trim().toLowerCase();
  const buildrCompanyId = String(input.buildrCompanyId || "").trim();
  if (!email || !buildrCompanyId) return null;

  const existing = resolveBuildrSsoIdentity(email, buildrCompanyId);
  const passwordHash = String(input.passwordHash || "").trim();
  const displayName = String(input.name || "").trim() || email.split("@")[0];
  const memberRole = mapBuildrRole(input.role);

  if (existing) {
    if (passwordHash) {
      db.prepare("UPDATE users SET password_hash = ?, name = ? WHERE id = ?").run(
        passwordHash,
        displayName,
        existing.userId,
      );
    }
    return existing;
  }

  let companyId = "";
  const companies = db
    .prepare("SELECT id FROM companies")
    .all() as { id: string }[];
  for (const row of companies) {
    const settings = getCompanyState(row.id).settings;
    if (String(settings.buildr_company_id || "").trim() === buildrCompanyId || row.id === buildrCompanyId) {
      companyId = row.id;
      break;
    }
  }

  if (!companyId) {
    companyId = buildrCompanyId;
    const companyName = String(input.companyName || "").trim() || "Buildr company";
    db.prepare(
      "INSERT INTO companies (id, name, slug, plan, plan_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(companyId, companyName, slugify(companyName), "starter", "active", new Date().toISOString());
    setCompanyState(companyId, {
      ...createEmptyState(companyName),
      settings: {
        ...createEmptyState(companyName).settings,
        buildr_linked: true,
        buildr_company_id: buildrCompanyId,
      },
    });
  } else {
    const state = getCompanyState(companyId);
    setCompanyState(companyId, {
      ...state,
      settings: {
        ...state.settings,
        buildr_linked: true,
        buildr_company_id: buildrCompanyId,
      },
    });
  }

  let user = getUserByEmail(email);
  if (!user) {
    if (!passwordHash) return null;
    const userId = uid("usr");
    db.prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(userId, email, displayName, passwordHash, new Date().toISOString());
    user = { id: userId, email, name: displayName, password_hash: passwordHash, created_at: "" };
  } else if (passwordHash) {
    db.prepare("UPDATE users SET password_hash = ?, name = ? WHERE id = ?").run(
      passwordHash,
      displayName,
      user.id,
    );
  }

  ensureCompanyMembership(user.id, companyId, memberRole);
  return { userId: user.id, companyId, role: memberRole };
}

export function setCompanyPlan(companyId: string, plan: PlanId) {
  db.prepare("UPDATE companies SET plan = ?, plan_status = ? WHERE id = ?").run(plan, "active", companyId);
}

export function updateCompanyName(companyId: string, name: string) {
  db.prepare("UPDATE companies SET name = ? WHERE id = ?").run(name, companyId);
}

export function setUserPassword(userId: string, password: string) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 12), userId);
}

export async function createPasswordReset(email: string) {
  const user = getUserByEmail(email);
  if (!user) return null;
  const token = uid("rst");
  const tokenHash = bcrypt.hashSync(token, 8);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
  db.prepare(
    "INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(uid("pr"), user.id, tokenHash, expiresAt, new Date().toISOString());
  return { token, email: user.email, stored: true as const };
}

export async function consumePasswordReset(token: string, password: string) {
  const rows = db.prepare("SELECT * FROM password_resets").all() as {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: string;
  }[];
  const row = rows.find((item) => bcrypt.compareSync(token, item.token_hash));
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "That reset link is invalid or expired." };
  }
  setUserPassword(row.user_id, password);
  db.prepare("DELETE FROM password_resets WHERE id = ?").run(row.id);
  return { ok: true as const };
}

export async function deleteCompanyWorkspace(companyId: string, actorUserId: string) {
  db.prepare("DELETE FROM sessions WHERE company_id = ?").run(companyId);
  db.prepare("DELETE FROM memberships WHERE company_id = ?").run(companyId);
  db.prepare("DELETE FROM company_state WHERE company_id = ?").run(companyId);
  db.prepare("DELETE FROM companies WHERE id = ?").run(companyId);
  const leftover = db.prepare("SELECT company_id FROM memberships WHERE user_id = ?").get(actorUserId) as
    | { company_id: string }
    | undefined;
  if (!leftover) {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(actorUserId);
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(actorUserId);
    db.prepare("DELETE FROM users WHERE id = ?").run(actorUserId);
  }
}

export function seedDemoTenant() {
  if (!demoWorkspaceEnabled()) return;
  if (getUserByEmail("demo@stockr.app")) return;
  const userId = "usr_demo";
  const companyId = "co_summit";
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, "demo@stockr.app", "Marcus Frey", bcrypt.hashSync("demo1234", 10), now);
  db.prepare(
    "INSERT INTO companies (id, name, slug, plan, plan_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(companyId, "Summit Electric", "summit-electric", "fleet", "active", now);
  db.prepare("INSERT INTO memberships (user_id, company_id, role) VALUES (?, ?, ?)").run(
    userId,
    companyId,
    "owner",
  );
  setCompanyState(companyId, createSeedState());
}

export function ensurePlatformOwner() {
  const now = new Date().toISOString();
  let company = getCompany(PLATFORM_OWNER_COMPANY_ID);
  if (!company) {
    db.prepare(
      "INSERT INTO companies (id, name, slug, plan, plan_status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      PLATFORM_OWNER_COMPANY_ID,
      PLATFORM_OWNER_COMPANY_NAME,
      "currentflow-consulting",
      "fleet",
      "active",
      now,
    );
    setCompanyState(PLATFORM_OWNER_COMPANY_ID, createEmptyState(PLATFORM_OWNER_COMPANY_NAME));
    company = getCompany(PLATFORM_OWNER_COMPANY_ID);
  }
  if (!company) throw new Error("Create CurrentFlow company: company missing after insert");

  for (const owner of seededOwnersToProvision()) {
    let user = getUserByEmail(owner.email);
    if (!user) {
      db.prepare(
        "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(owner.userId, owner.email, owner.name, bcrypt.hashSync(owner.resolvedPassword, 10), now);
      user = getUserByEmail(owner.email);
    } else if (owner.resetPassword) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        bcrypt.hashSync(owner.resolvedPassword, 10),
        user.id,
      );
    }
    if (!user) throw new Error(`Create platform owner: ${owner.email} missing after insert`);
    ensureCompanyMembership(user.id, company.id, "owner");
  }
}

seedDemoTenant();
ensurePlatformOwner();
