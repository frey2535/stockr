import bcrypt from "bcryptjs";
import { createEmptyState, createSeedState, normalizeStoreState } from "./seed";
import { encodeStateForPersist } from "./persist-state";
import { toolsFromProjects } from "./tools-state";
import { planLimitError } from "./plans";
import { getSupabaseAdmin } from "./supabase-admin";
import { selectAllForCompany } from "./supabase-page";
import { tokenLookup } from "./token-lookup";
import { uid } from "./id";
import {
  PLATFORM_OWNER_COMPANY_ID,
  PLATFORM_OWNER_COMPANY_NAME,
  isPlatformOwner,
  seededOwnersToProvision,
} from "./platform";
import type {
  AccessCode,
  Account,
  InventoryItem,
  Location,
  Material,
  MemberRole,
  PlanId,
  PlatformCompany,
  Project,
  PurchaseOrder,
  StoreState,
  TeamMember,
  Tool,
  Transaction,
} from "./types";

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
};

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  plan_status: "trialing" | "active" | "past_due";
  logo_url: string;
  primary_color: string;
  accent_color: string;
  buildr_linked: boolean;
  buildr_company_id: string;
  play_product_id?: string | null;
  play_purchase_token?: string | null;
  play_expires_at?: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  company_id: string;
  expires_at: string;
};

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
  return `${base}-${uid("co").slice(-6)}`;
}

function throwIfError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

export async function getCompanyState(companyId: string): Promise<StoreState> {
  const supabase = getSupabaseAdmin();
  const [companyRes, locations, materials, inventory, transactions, purchaseOrders, lines, accessCodes, projects, tools] =
    await Promise.all([
      supabase.from("stockr_companies").select("*").eq("id", companyId).maybeSingle(),
      selectAllForCompany<Location>(supabase, "stockr_locations", companyId),
      selectAllForCompany<Material>(supabase, "stockr_materials", companyId),
      selectAllForCompany<InventoryItem>(supabase, "stockr_inventory", companyId),
      selectAllForCompany<Transaction>(supabase, "stockr_transactions", companyId),
      selectAllForCompany<PurchaseOrder>(supabase, "stockr_purchase_orders", companyId),
      selectAllForCompany<{
        purchase_order_id: string;
        material_id: string;
        expected_quantity: number;
        received_quantity: number;
        unit_cost: number | null;
      }>(supabase, "stockr_purchase_order_lines", companyId),
      selectAllForCompany<AccessCode>(supabase, "stockr_access_codes", companyId),
      selectAllForCompany<Project>(supabase, "stockr_projects", companyId),
      selectAllForCompany<Tool>(supabase, "stockr_tools", companyId),
    ]);

  throwIfError(companyRes.error, "Load company workspace");

  const company = companyRes.data as CompanyRow | null;
  if (!company) return createEmptyState("New company");

  const linesByPo = new Map<string, PurchaseOrder["lines"]>();
  for (const line of lines) {
    const rows = linesByPo.get(line.purchase_order_id) || [];
    rows.push({
      material_id: line.material_id,
      expected_quantity: Number(line.expected_quantity),
      received_quantity: Number(line.received_quantity),
      unit_cost: line.unit_cost == null ? undefined : Number(line.unit_cost),
    });
    linesByPo.set(line.purchase_order_id, rows);
  }

  const purchaseOrdersMapped: PurchaseOrder[] = purchaseOrders.map((row) => ({
    id: row.id,
    po_number: row.po_number,
    supplier: row.supplier,
    expected_delivery: row.expected_delivery || undefined,
    status: row.status,
    created_at: row.created_at,
    lines: linesByPo.get(row.id) || [],
  }));

  return normalizeStoreState({
    settings: {
      company_name: company.name,
      logo_url: company.logo_url,
      primary_color: company.primary_color,
      accent_color: company.accent_color,
      buildr_linked: company.buildr_linked,
      buildr_company_id: company.buildr_company_id,
    },
    locations,
    materials: materials.map((row) => ({
      ...row,
      unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
      reorder_point: row.reorder_point == null ? null : Number(row.reorder_point),
      min_stock_level: row.min_stock_level == null ? null : Number(row.min_stock_level),
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
    })),
    inventory: inventory.map((row) => ({
      id: row.id,
      material_id: row.material_id,
      location_id: row.location_id,
      quantity: Number(row.quantity),
    })),
    transactions: transactions.map((row) => ({
      ...row,
      quantity: Number(row.quantity),
    })),
    purchaseOrders: purchaseOrdersMapped,
    accessCodes,
    projects,
    tools: tools.length ? tools : toolsFromProjects(projects, []),
    stockRules: [],
  });
}

async function saveTools(companyId: string, tools: Tool[]) {
  const supabase = getSupabaseAdmin();
  const del = await supabase.from("stockr_tools").delete().eq("company_id", companyId);
  if (del.error) return;
  if (!tools.length) return;
  const insert = await supabase.from("stockr_tools").insert(
    tools.map((tool) => ({
      id: tool.id,
      company_id: companyId,
      name: tool.name,
      description: tool.description || "",
      category: tool.category || "",
      barcode: tool.barcode || "",
      assigned_location_id: tool.assigned_location_id,
      assigned_to: tool.assigned_to || "",
      status: tool.status,
    })),
  );
  if (insert.error) throwIfError(insert.error, "Save tools");
}

export async function setCompanyState(companyId: string, state: StoreState) {
  const supabase = getSupabaseAdmin();
  const next = encodeStateForPersist(normalizeStoreState(state));
  const { error } = await supabase.rpc("stockr_replace_company_state", {
    p_company_id: companyId,
    p_state: next,
  });
  throwIfError(error, "Save company workspace");
  await saveTools(companyId, normalizeStoreState(state).tools);
}

export async function getUserByEmail(email: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  throwIfError(error, "Look up user");
  return (data as UserRow | null) || undefined;
}

export async function getUserById(id: string) {
  const { data, error } = await getSupabaseAdmin().from("stockr_users").select("*").eq("id", id).maybeSingle();
  throwIfError(error, "Look up user");
  return (data as UserRow | null) || undefined;
}

export async function getCompany(id: string) {
  const { data, error } = await getSupabaseAdmin().from("stockr_companies").select("*").eq("id", id).maybeSingle();
  throwIfError(error, "Look up company");
  return (data as CompanyRow | null) || undefined;
}

export async function listMembers(companyId: string): Promise<TeamMember[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_memberships")
    .select("role, stockr_users ( id, email, name )")
    .eq("company_id", companyId);
  throwIfError(error, "List members");
  return (data || []).map((row) => {
    const user = row.stockr_users as unknown as { id: string; email: string; name: string };
    return { id: user.id, email: user.email, name: user.name, role: row.role as MemberRole };
  });
}

export async function getAccount(
  userId: string,
  companyId: string,
  options?: { members?: boolean },
): Promise<Account | null> {
  const supabase = getSupabaseAdmin();
  const [user, company, membershipRes] = await Promise.all([
    getUserById(userId),
    getCompany(companyId),
    supabase
      .from("stockr_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);
  throwIfError(membershipRes.error, "Look up membership");
  if (!user || !company || !membershipRes.data) return null;
  const live = await expirePlayPlan(company);
  return {
    user: { id: user.id, email: user.email, name: user.name },
    company: {
      id: live.id,
      name: live.name,
      slug: live.slug,
      plan: live.plan,
      planStatus: live.plan_status,
    },
    role: membershipRes.data.role as MemberRole,
    members: options?.members === false ? [] : await listMembers(companyId),
    dataBackend: "supabase",
    platformOwner: isPlatformOwner(user.email),
  };
}

export async function createSession(userId: string, companyId: string) {
  const id = uid("ses");
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error } = await getSupabaseAdmin().from("stockr_sessions").insert({
    id,
    user_id: userId,
    company_id: companyId,
    expires_at: expiresAt,
  });
  throwIfError(error, "Create session");
  return { id, expiresAt };
}

export async function getSession(id: string) {
  const { data, error } = await getSupabaseAdmin().from("stockr_sessions").select("*").eq("id", id).maybeSingle();
  throwIfError(error, "Look up session");
  const row = data as SessionRow | null;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await deleteSession(id);
    return null;
  }
  return row;
}

export async function deleteSession(id: string) {
  const { error } = await getSupabaseAdmin().from("stockr_sessions").delete().eq("id", id);
  throwIfError(error, "Delete session");
}

export async function createCompanyWithOwner(input: {
  email: string;
  name: string;
  password: string;
  companyName: string;
  inviteCode?: string;
}) {
  const supabase = getSupabaseAdmin();
  const email = input.email.trim().toLowerCase();
  if (await getUserByEmail(email)) return { error: "An account with that email already exists." };

  if (input.inviteCode) {
    const { data: invite, error } = await supabase
      .from("stockr_access_codes")
      .select("company_id, expires_at, is_active")
      .ilike("code", input.inviteCode.trim())
      .eq("is_active", true)
      .maybeSingle();
    throwIfError(error, "Look up invite");
    if (!invite) return { error: "Invite code is invalid or expired." };
    if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
      return { error: "Invite code is invalid or expired." };
    }
    const company = await getCompany(invite.company_id);
    if (!company) return { error: "Invite code is invalid or expired." };
    const members = await listMembers(company.id);
    const seatError = planLimitError(company.plan, {}, "seat", members.length);
    if (seatError) return { error: seatError };

    const userId = uid("usr");
    const userInsert = await supabase.from("stockr_users").insert({
      id: userId,
      email,
      name: input.name.trim() || email.split("@")[0],
      password_hash: bcrypt.hashSync(input.password, 10),
    });
    throwIfError(userInsert.error, "Create user");
    const memberInsert = await supabase.from("stockr_memberships").insert({
      user_id: userId,
      company_id: company.id,
      role: "member",
    });
    throwIfError(memberInsert.error, "Join company");
    return { userId, companyId: company.id };
  }

  const userId = uid("usr");
  const companyId = uid("co");
  const companyName = input.companyName.trim() || "My company";
  const userInsert = await supabase.from("stockr_users").insert({
    id: userId,
    email,
    name: input.name.trim() || email.split("@")[0],
    password_hash: bcrypt.hashSync(input.password, 10),
  });
  throwIfError(userInsert.error, "Create user");
  const companyInsert = await supabase.from("stockr_companies").insert({
    id: companyId,
    name: companyName,
    slug: slugify(input.companyName),
    plan: "starter",
    plan_status: "trialing",
  });
  throwIfError(companyInsert.error, "Create company");
  const memberInsert = await supabase.from("stockr_memberships").insert({
    user_id: userId,
    company_id: companyId,
    role: "owner",
  });
  throwIfError(memberInsert.error, "Create membership");
  await setCompanyState(companyId, createEmptyState(companyName));
  return { userId, companyId };
}

export async function verifyPassword(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_memberships")
    .select("company_id")
    .eq("user_id", user.id);
  throwIfError(error, "Look up membership");
  const companyIds = (data || []).map((row) => row.company_id as string);
  if (companyIds.length === 0) return null;
  const preferred = isPlatformOwner(user.email) ? PLATFORM_OWNER_COMPANY_ID : "";
  const companyId = companyIds.includes(preferred) ? preferred : companyIds[0];
  return { userId: user.id, companyId };
}

export async function listCompanies(): Promise<PlatformCompany[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: companies, error: companyError }, { data: memberships, error: memberError }] =
    await Promise.all([
      supabase.from("stockr_companies").select("id, name, slug, plan, plan_status").order("name"),
      supabase.from("stockr_memberships").select("company_id"),
    ]);
  throwIfError(companyError, "List companies");
  throwIfError(memberError, "Count members");
  const counts = new Map<string, number>();
  for (const row of memberships || []) {
    const id = row.company_id as string;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return (companies || []).map((company) => ({
    id: company.id as string,
    name: company.name as string,
    slug: company.slug as string,
    plan: company.plan as PlanId,
    planStatus: company.plan_status as PlatformCompany["planStatus"],
    memberCount: counts.get(company.id as string) || 0,
  }));
}

export async function ensureCompanyMembership(userId: string, companyId: string, role: MemberRole) {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  throwIfError(error, "Look up membership");
  if (data) return;
  const insert = await getSupabaseAdmin().from("stockr_memberships").insert({
    user_id: userId,
    company_id: companyId,
    role,
  });
  throwIfError(insert.error, "Grant membership");
}


export async function resolveBuildrSsoIdentity(email: string, buildrCompanyId: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedBuildrCompanyId = String(buildrCompanyId || "").trim();
  if (!normalizedEmail || !normalizedBuildrCompanyId) return null;

  const supabase = getSupabaseAdmin();
  const [{ data: user, error: userError }, { data: company, error: companyError }] =
    await Promise.all([
      supabase
        .from("stockr_users")
        .select("id, email")
        .eq("email", normalizedEmail)
        .maybeSingle(),
      supabase
        .from("stockr_companies")
        .select("id, buildr_linked, buildr_company_id")
        .eq("buildr_linked", true)
        .eq("buildr_company_id", normalizedBuildrCompanyId)
        .maybeSingle(),
    ]);

  throwIfError(userError, "Resolve Buildr SSO user");
  throwIfError(companyError, "Resolve Buildr SSO company");
  if (!user || !company) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("stockr_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("company_id", company.id)
    .maybeSingle();
  throwIfError(membershipError, "Resolve Buildr SSO membership");
  if (!membership) return null;

  return {
    userId: user.id as string,
    companyId: company.id as string,
    role: membership.role as MemberRole,
  };
}

export async function setPlayPurchase(
  companyId: string,
  input: { productId: string; purchaseToken: string; expiresAt?: string | null },
) {
  const { error } = await getSupabaseAdmin()
    .from("stockr_companies")
    .update({
      play_product_id: input.productId,
      play_purchase_token: input.purchaseToken,
      play_expires_at: input.expiresAt || null,
    })
    .eq("id", companyId);
  throwIfError(error, "Save Play purchase");
}

async function expirePlayPlan(company: CompanyRow) {
  if (!company.play_purchase_token || !company.play_expires_at) return company;
  if (new Date(company.play_expires_at).getTime() > Date.now()) return company;
  if (company.plan === "starter") return company;
  await setCompanyPlan(company.id, "starter");
  await getSupabaseAdmin()
    .from("stockr_companies")
    .update({ play_product_id: null, play_purchase_token: null, play_expires_at: null })
    .eq("id", company.id);
  return { ...company, plan: "starter" as PlanId, plan_status: "active" as const };
}

export async function setCompanyPlan(companyId: string, plan: PlanId) {
  const { error } = await getSupabaseAdmin()
    .from("stockr_companies")
    .update({ plan, plan_status: "active" })
    .eq("id", companyId);
  throwIfError(error, "Update plan");
}

export async function updateCompanyName(companyId: string, name: string) {
  const { error } = await getSupabaseAdmin().from("stockr_companies").update({ name }).eq("id", companyId);
  throwIfError(error, "Rename company");
}

export async function setUserPassword(userId: string, password: string) {
  const { error } = await getSupabaseAdmin()
    .from("stockr_users")
    .update({ password_hash: bcrypt.hashSync(password, 12) })
    .eq("id", userId);
  throwIfError(error, "Update password");
}

export async function createPasswordReset(email: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const token = uid("rst");
  const tokenHash = bcrypt.hashSync(token, 8);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await getSupabaseAdmin().from("stockr_password_resets").delete().eq("user_id", user.id);
  const insert = await getSupabaseAdmin().from("stockr_password_resets").insert({
    id: uid("pr"),
    user_id: user.id,
    token_hash: tokenHash,
    token_lookup: tokenLookup(token),
    expires_at: expiresAt,
  });
  if (insert.error) return { token, email: user.email, stored: false as const };
  return { token, email: user.email, stored: true as const };
}

export async function consumePasswordReset(token: string, password: string) {
  const supabase = getSupabaseAdmin();
  const lookup = await supabase.from("stockr_password_resets").select("*").eq("token_lookup", tokenLookup(token)).maybeSingle();
  throwIfError(lookup.error, "Look up password reset");
  let row = lookup.data;
  if (!row) {
    const { data, error } = await supabase.from("stockr_password_resets").select("*").is("token_lookup", null);
    throwIfError(error, "Look up password reset");
    row = (data || []).find((item) => bcrypt.compareSync(token, String(item.token_hash || ""))) || null;
  }
  if (!row || new Date(String(row.expires_at)).getTime() < Date.now()) {
    return { error: "That reset link is invalid or expired." };
  }
  if (row.token_hash && !bcrypt.compareSync(token, String(row.token_hash))) {
    return { error: "That reset link is invalid or expired." };
  }
  await setUserPassword(String(row.user_id), password);
  await supabase.from("stockr_password_resets").delete().eq("id", row.id);
  return { ok: true as const };
}

export async function deleteCompanyWorkspace(companyId: string, actorUserId: string) {
  const supabase = getSupabaseAdmin();
  const tables = [
    "stockr_cycle_count_lines",
    "stockr_cycle_count_sessions",
    "stockr_material_request_lines",
    "stockr_material_requests",
    "stockr_inventory_reservations",
    "stockr_storage_bins",
    "stockr_storage_zones",
    "stockr_purchase_order_lines",
    "stockr_purchase_orders",
    "stockr_transactions",
    "stockr_inventory",
    "stockr_tools",
    "stockr_projects",
    "stockr_access_codes",
    "stockr_materials",
    "stockr_locations",
    "stockr_sessions",
    "stockr_memberships",
  ];
  for (const table of tables) {
    await supabase.from(table).delete().eq("company_id", companyId);
  }
  await supabase.from("stockr_companies").delete().eq("id", companyId);
  const { data: leftover } = await supabase.from("stockr_memberships").select("company_id").eq("user_id", actorUserId);
  if (!leftover?.length) {
    await supabase.from("stockr_sessions").delete().eq("user_id", actorUserId);
    await supabase.from("stockr_users").delete().eq("id", actorUserId);
  }
}

export async function seedDemoTenant() {
  const { demoWorkspaceEnabled } = await import("./production");
  if (!demoWorkspaceEnabled()) return;
  if (await getUserByEmail("demo@stockr.app")) return;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const userInsert = await supabase.from("stockr_users").insert({
    id: "usr_demo",
    email: "demo@stockr.app",
    name: "Marcus Frey",
    password_hash: bcrypt.hashSync("demo1234", 10),
    created_at: now,
  });
  throwIfError(userInsert.error, "Seed demo user");
  const companyInsert = await supabase.from("stockr_companies").insert({
    id: "co_summit",
    name: "Summit Electric",
    slug: "summit-electric",
    plan: "fleet",
    plan_status: "active",
    created_at: now,
  });
  throwIfError(companyInsert.error, "Seed demo company");
  const memberInsert = await supabase.from("stockr_memberships").insert({
    user_id: "usr_demo",
    company_id: "co_summit",
    role: "owner",
  });
  throwIfError(memberInsert.error, "Seed demo membership");
  await setCompanyState("co_summit", createSeedState());
}

export async function ensurePlatformOwner() {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let company = await getCompany(PLATFORM_OWNER_COMPANY_ID);
  if (!company) {
    const insert = await supabase.from("stockr_companies").insert({
      id: PLATFORM_OWNER_COMPANY_ID,
      name: PLATFORM_OWNER_COMPANY_NAME,
      slug: "currentflow-consulting",
      plan: "fleet",
      plan_status: "active",
      created_at: now,
    });
    throwIfError(insert.error, "Create CurrentFlow company");
    await setCompanyState(PLATFORM_OWNER_COMPANY_ID, createEmptyState(PLATFORM_OWNER_COMPANY_NAME));
    company = await getCompany(PLATFORM_OWNER_COMPANY_ID);
  }
  if (!company) throw new Error("Create CurrentFlow company: company missing after insert");

  for (const owner of seededOwnersToProvision()) {
    let user = await getUserByEmail(owner.email);
    if (!user) {
      const insert = await supabase.from("stockr_users").insert({
        id: owner.userId,
        email: owner.email,
        name: owner.name,
        password_hash: bcrypt.hashSync(owner.resolvedPassword, 10),
        created_at: now,
      });
      throwIfError(insert.error, `Create platform owner ${owner.email}`);
      user = await getUserByEmail(owner.email);
    } else if (owner.resetPassword) {
      const update = await supabase
        .from("stockr_users")
        .update({ password_hash: bcrypt.hashSync(owner.resolvedPassword, 10) })
        .eq("id", user.id);
      throwIfError(update.error, `Reset platform owner password ${owner.email}`);
    }
    if (!user) throw new Error(`Create platform owner: ${owner.email} missing after insert`);
    await ensureCompanyMembership(user.id, company.id, "owner");
  }
}
