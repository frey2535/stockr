import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { createEmptyState, createSeedState } from "./seed";
import { planLimitError } from "./plans";
import type { Account, MemberRole, PlanId, StoreState, TeamMember } from "./types";
import { uid } from "./id";

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
  return plain(JSON.parse(row.payload) as StoreState);
}

export function setCompanyState(companyId: string, state: StoreState) {
  db.prepare(
    `INSERT INTO company_state (company_id, payload) VALUES (?, ?)
     ON CONFLICT(company_id) DO UPDATE SET payload = excluded.payload`,
  ).run(companyId, JSON.stringify(state));
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

export function getAccount(userId: string, companyId: string): Account | null {
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
    members: listMembers(companyId),
    dataBackend: "sqlite",
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

export function createCompanyWithOwner(input: {
  email: string;
  name: string;
  password: string;
  companyName: string;
  inviteCode?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (getUserByEmail(email)) return { error: "An account with that email already exists." };

  if (input.inviteCode) {
    const companies = db.prepare("SELECT id FROM companies").all() as { id: string }[];
    for (const company of companies) {
      const state = getCompanyState(company.id);
      const invite = state.accessCodes.find(
        (code) =>
          code.is_active &&
          code.code.toLowerCase() === input.inviteCode!.trim().toLowerCase() &&
          (!code.expires_at || new Date(code.expires_at) > new Date()),
      );
      if (!invite) continue;
      const companyRow = getCompany(company.id);
      if (!companyRow) continue;
      const seatError = planLimitError(
        companyRow.plan,
        {},
        "seat",
        listMembers(company.id).length,
      );
      if (seatError) return { error: seatError };
      const userId = uid("usr");
      db.prepare(
        "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(userId, email, input.name.trim() || email.split("@")[0], bcrypt.hashSync(input.password, 10), new Date().toISOString());
      db.prepare("INSERT INTO memberships (user_id, company_id, role) VALUES (?, ?, ?)").run(
        userId,
        company.id,
        "member",
      );
      return { userId, companyId: company.id };
    }
    return { error: "Invite code is invalid or expired." };
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
  const membership = db
    .prepare("SELECT company_id FROM memberships WHERE user_id = ?")
    .get(user.id) as { company_id: string } | undefined;
  if (!membership) return null;
  return { userId: user.id, companyId: membership.company_id };
}

export function setCompanyPlan(companyId: string, plan: PlanId) {
  db.prepare("UPDATE companies SET plan = ?, plan_status = ? WHERE id = ?").run(plan, "active", companyId);
}

export function updateCompanyName(companyId: string, name: string) {
  db.prepare("UPDATE companies SET name = ? WHERE id = ?").run(name, companyId);
}

export function seedDemoTenant() {
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

seedDemoTenant();
