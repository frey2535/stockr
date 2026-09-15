import { isSupabaseConfigured } from "./db-config";
import { getCompanyState } from "./db";
import { getSupabaseAdmin } from "./supabase-admin";
import { onHand, totalValue } from "./inventory";
import { WORKSPACE_PAGE_SIZE } from "./types";
import type {
  AccessCode,
  InventoryItem,
  Location,
  Material,
  Project,
  PurchaseOrder,
  Settings,
  StoreState,
  Tool,
  Transaction,
  WorkspaceShell,
} from "./types";
import type { DashboardPayload } from "./workspace-types";
import { projectsWithoutToolsBlob, toolsFromProjects } from "./tools-state";

function clampLimit(value: number | undefined) {
  return Math.min(Math.max(value || WORKSPACE_PAGE_SIZE, 1), 100);
}

function sanitizeFilter(value: string) {
  return value.replace(/[%_,.()\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function mapMaterial(row: Record<string, unknown>): Material {
  return {
    ...(row as Material),
    unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
    reorder_point: row.reorder_point == null ? null : Number(row.reorder_point),
    min_stock_level: row.min_stock_level == null ? null : Number(row.min_stock_level),
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
  };
}

function mapInventory(row: Record<string, unknown>): InventoryItem {
  return {
    id: String(row.id),
    material_id: String(row.material_id),
    location_id: String(row.location_id),
    quantity: Number(row.quantity),
  };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    ...(row as Transaction),
    quantity: Number(row.quantity),
  };
}

function shellFromState(state: StoreState): WorkspaceShell {
  return {
    settings: state.settings,
    locations: state.locations,
    projects: state.projects,
    accessCodes: state.accessCodes,
    tools: state.tools || [],
    counts: {
      locations: state.locations.length,
      materials: state.materials.length,
      inventoryRows: state.inventory.length,
      transactions: state.transactions.length,
      purchaseOrders: state.purchaseOrders.length,
      tools: (state.tools || []).length,
    },
  };
}

export async function getWorkspaceShell(companyId: string): Promise<WorkspaceShell> {
  if (!isSupabaseConfigured()) {
    return shellFromState(await getCompanyState(companyId));
  }

  const supabase = getSupabaseAdmin();
  const [companyRes, locationsRes, projectsRes, codesRes, toolsRes, materials, inventory, transactions, purchaseOrders] =
    await Promise.all([
      supabase.from("stockr_companies").select("*").eq("id", companyId).maybeSingle(),
      supabase.from("stockr_locations").select("*").eq("company_id", companyId),
      supabase.from("stockr_projects").select("*").eq("company_id", companyId),
      supabase.from("stockr_access_codes").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("stockr_tools").select("*").eq("company_id", companyId),
      supabase.from("stockr_materials").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("stockr_inventory").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("stockr_transactions").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabase.from("stockr_purchase_orders").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ]);

  if (companyRes.error) throw new Error(`Load company: ${companyRes.error.message}`);
  const company = companyRes.data;
  if (!company) {
    return {
      settings: {
        company_name: "New company",
        logo_url: "",
        primary_color: "#12203a",
        accent_color: "#f97316",
        buildr_linked: false,
        buildr_company_id: "",
      },
      locations: [],
      projects: [],
      accessCodes: [],
      tools: [],
      counts: { locations: 0, materials: 0, inventoryRows: 0, transactions: 0, purchaseOrders: 0, tools: 0 },
    };
  }

  const settings: Settings = {
    company_name: company.name,
    logo_url: company.logo_url,
    primary_color: company.primary_color,
    accent_color: company.accent_color,
    buildr_linked: company.buildr_linked,
    buildr_company_id: company.buildr_company_id,
  };

  const rawProjects = (projectsRes.data || []) as Project[];
  const tableTools = toolsRes.error ? [] : ((toolsRes.data || []) as Tool[]);
  const tools = tableTools.length ? tableTools : toolsFromProjects(rawProjects);

  return {
    settings,
    locations: (locationsRes.data || []) as Location[],
    projects: projectsWithoutToolsBlob(rawProjects),
    accessCodes: (codesRes.data || []) as AccessCode[],
    tools,
    counts: {
      locations: (locationsRes.data || []).length,
      materials: materials.count || 0,
      inventoryRows: inventory.count || 0,
      transactions: transactions.count || 0,
      purchaseOrders: purchaseOrders.count || 0,
      tools: tools.length,
    },
  };
}

export async function getDashboard(companyId: string): Promise<DashboardPayload> {
  if (!isSupabaseConfigured()) {
    const state = await getCompanyState(companyId);
    const alerts = state.materials
      .map((material) => {
        const totalQty = onHand(state, material.id);
        let status: "critical" | "reorder" | null = null;
        if (material.min_stock_level != null && totalQty <= material.min_stock_level) status = "critical";
        else if (material.reorder_point != null && totalQty <= material.reorder_point) status = "reorder";
        return { ...material, totalQty, status };
      })
      .filter((row) => row.status)
      .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "critical" ? -1 : 1))
      .slice(0, 25) as DashboardPayload["alerts"];

    return {
      totalItems: state.inventory.reduce((sum, row) => sum + (row.quantity || 0), 0),
      value: totalValue(state),
      vehicles: state.locations.filter((row) => row.type === "vehicle").length,
      warehouses: state.locations.filter((row) => row.type === "warehouse").length,
      materialCount: state.materials.length,
      alerts,
      locations: state.locations.map((location) => {
        const rows = state.inventory.filter((row) => row.location_id === location.id && row.quantity > 0);
        return {
          ...location,
          units: rows.reduce((sum, row) => sum + row.quantity, 0),
          materialCount: rows.length,
        };
      }),
      recent: state.transactions.slice(0, 10),
      recentMaterials: state.materials.filter((material) =>
        state.transactions.slice(0, 10).some((tx) => tx.material_id === material.id),
      ),
    };
  }

  const supabase = getSupabaseAdmin();
  const [inventoryRes, costRes, alertRes, locationsRes, txRes, materialCountRes] = await Promise.all([
    supabase.from("stockr_inventory").select("material_id, location_id, quantity").eq("company_id", companyId),
    supabase.from("stockr_materials").select("id, unit_cost").eq("company_id", companyId),
    supabase
      .from("stockr_materials")
      .select("id, name, unit, unit_cost, reorder_point, min_stock_level")
      .eq("company_id", companyId)
      .or("reorder_point.not.is.null,min_stock_level.not.is.null"),
    supabase.from("stockr_locations").select("*").eq("company_id", companyId),
    supabase
      .from("stockr_transactions")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("stockr_materials").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ]);

  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  if (costRes.error) throw new Error(costRes.error.message);
  if (alertRes.error) throw new Error(alertRes.error.message);
  if (locationsRes.error) throw new Error(locationsRes.error.message);
  if (txRes.error) throw new Error(txRes.error.message);
  if (materialCountRes.error) throw new Error(materialCountRes.error.message);

  const inventory = (inventoryRes.data || []).map(mapInventory);
  const alertMaterials = (alertRes.data || []).map(mapMaterial);
  const locations = (locationsRes.data || []) as Location[];
  const costById = new Map(
    (costRes.data || []).map((row) => [String(row.id), row.unit_cost == null ? 0 : Number(row.unit_cost)]),
  );

  const totalItems = inventory.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const value = inventory.reduce((sum, row) => sum + (row.quantity || 0) * (costById.get(row.material_id) || 0), 0);

  const qtyByMaterial = new Map<string, number>();
  for (const row of inventory) {
    qtyByMaterial.set(row.material_id, (qtyByMaterial.get(row.material_id) || 0) + row.quantity);
  }

  const alerts = alertMaterials
    .map((material) => {
      const totalQty = qtyByMaterial.get(material.id) || 0;
      let status: "critical" | "reorder" | null = null;
      if (material.min_stock_level != null && totalQty <= material.min_stock_level) status = "critical";
      else if (material.reorder_point != null && totalQty <= material.reorder_point) status = "reorder";
      return { ...material, totalQty, status };
    })
    .filter((row) => row.status)
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "critical" ? -1 : 1))
    .slice(0, 25) as DashboardPayload["alerts"];

  const recent = (txRes.data || []).map(mapTransaction);
  const recentIds = new Set(recent.map((tx) => tx.material_id));
  const recentMaterials = alertMaterials.filter((material) => recentIds.has(material.id));
  if (recentIds.size && recentMaterials.length < recentIds.size) {
    const missing = Array.from(recentIds).filter((id) => !recentMaterials.some((row) => row.id === id));
    if (missing.length) {
      const names = await supabase
        .from("stockr_materials")
        .select("id, name, unit, unit_cost, reorder_point, min_stock_level")
        .eq("company_id", companyId)
        .in("id", missing);
      if (names.error) throw new Error(names.error.message);
      recentMaterials.push(...(names.data || []).map(mapMaterial));
    }
  }

  return {
    totalItems,
    value,
    vehicles: locations.filter((row) => row.type === "vehicle").length,
    warehouses: locations.filter((row) => row.type === "warehouse").length,
    materialCount: materialCountRes.count || costById.size,
    alerts,
    locations: locations.map((location) => {
      const rows = inventory.filter((row) => row.location_id === location.id && row.quantity > 0);
      return {
        ...location,
        units: rows.reduce((sum, row) => sum + row.quantity, 0),
        materialCount: rows.length,
      };
    }),
    recent,
    recentMaterials,
  };
}

export type InventoryRow = {
  material: Material;
  byLocation: { location: Location; quantity: number }[];
  total: number;
};

export async function listInventory(
  companyId: string,
  opts: { q?: string; locationId?: string; limit?: number; offset?: number },
) {
  const limit = clampLimit(opts.limit);
  const offset = Math.max(opts.offset || 0, 0);
  const q = sanitizeFilter((opts.q || "").trim().toLowerCase());
  const locationId = opts.locationId && opts.locationId !== "all" ? opts.locationId : "";

  if (!isSupabaseConfigured()) {
    const state = await getCompanyState(companyId);
    const rows = state.materials
      .map((material) => {
        const byLocation = state.locations
          .map((location) => ({ location, quantity: onHand(state, material.id, location.id) }))
          .filter((row) => row.quantity > 0);
        return { material, byLocation, total: byLocation.reduce((sum, row) => sum + row.quantity, 0) };
      })
      .filter((row) => {
        if (locationId && !row.byLocation.some((item) => item.location.id === locationId)) return false;
        if (!q) return true;
        return (
          row.material.name.toLowerCase().includes(q) ||
          (row.material.category || "").toLowerCase().includes(q) ||
          (row.material.barcode || "").includes(q)
        );
      })
      .sort((a, b) => a.material.name.localeCompare(b.material.name));
    return { rows: rows.slice(offset, offset + limit), total: rows.length };
  }

  const supabase = getSupabaseAdmin();
  let allowedIds: string[] | null = null;
  if (locationId) {
    const atLocation = await supabase
      .from("stockr_inventory")
      .select("material_id")
      .eq("company_id", companyId)
      .eq("location_id", locationId)
      .gt("quantity", 0);
    if (atLocation.error) throw new Error(atLocation.error.message);
    allowedIds = Array.from(new Set((atLocation.data || []).map((row) => row.material_id)));
    if (allowedIds.length === 0) return { rows: [], total: 0 };
  }

  let materialQuery = supabase
    .from("stockr_materials")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("name");
  if (q) {
    materialQuery = materialQuery.or(`name.ilike.%${q}%,category.ilike.%${q}%,barcode.ilike.%${q}%`);
  }
  if (allowedIds) materialQuery = materialQuery.in("id", allowedIds);
  const [materialsRes, locationsRes] = await Promise.all([
    materialQuery.range(offset, offset + limit - 1),
    supabase.from("stockr_locations").select("id, name, type, description, assigned_to").eq("company_id", companyId),
  ]);
  if (materialsRes.error) throw new Error(materialsRes.error.message);
  if (locationsRes.error) throw new Error(locationsRes.error.message);
  const materials = (materialsRes.data || []).map(mapMaterial);
  const locations = (locationsRes.data || []) as Location[];

  const inventoryRes = materials.length
    ? await supabase
        .from("stockr_inventory")
        .select("*")
        .eq("company_id", companyId)
        .in(
          "material_id",
          materials.map((row) => row.id),
        )
    : { data: [], error: null };
  if (inventoryRes.error) throw new Error(inventoryRes.error.message);
  const inventory = (inventoryRes.data || []).map(mapInventory);

  const rows = materials.map((material) => {
    const byLocation = locations
      .map((location) => ({
        location,
        quantity: inventory
          .filter((row) => row.material_id === material.id && row.location_id === location.id)
          .reduce((sum, row) => sum + row.quantity, 0),
      }))
      .filter((row) => row.quantity > 0);
    return { material, byLocation, total: byLocation.reduce((sum, row) => sum + row.quantity, 0) };
  });

  return { rows, total: materialsRes.count || rows.length };
}

export async function listActivity(
  companyId: string,
  opts: { q?: string; type?: string; limit?: number; offset?: number },
) {
  const limit = clampLimit(opts.limit);
  const offset = Math.max(opts.offset || 0, 0);
  const q = sanitizeFilter((opts.q || "").trim().toLowerCase());
  const type = opts.type && opts.type !== "all" ? opts.type : "";

  if (!isSupabaseConfigured()) {
    const state = await getCompanyState(companyId);
    const rows = state.transactions.filter((tx) => {
      if (type && tx.type !== type) return false;
      if (!q) return true;
      const material = state.materials.find((row) => row.id === tx.material_id);
      const from = state.locations.find((row) => row.id === tx.from_location_id);
      const to = state.locations.find((row) => row.id === tx.to_location_id);
      return `${material?.name || ""} ${from?.name || ""} ${to?.name || ""} ${tx.project || ""} ${tx.notes || ""} ${tx.created_by || ""}`
        .toLowerCase()
        .includes(q);
    });
    return {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      materialNames: Object.fromEntries(state.materials.map((row) => [row.id, row.name])),
    };
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("stockr_transactions")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (type) query = query.eq("type", type);
  if (q) {
    const materials = await supabase
      .from("stockr_materials")
      .select("id")
      .eq("company_id", companyId)
      .ilike("name", `%${q}%`);
    const ids = (materials.data || []).map((row) => row.id);
    if (ids.length) {
      query = query.or(`project.ilike.%${q}%,notes.ilike.%${q}%,created_by.ilike.%${q}%,material_id.in.(${ids.join(",")})`);
    } else {
      query = query.or(`project.ilike.%${q}%,notes.ilike.%${q}%,created_by.ilike.%${q}%`);
    }
  }
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const rows = (data || []).map(mapTransaction);
  const materialIds = Array.from(new Set(rows.map((row) => row.material_id)));
  const namesRes = materialIds.length
    ? await supabase.from("stockr_materials").select("id, name").eq("company_id", companyId).in("id", materialIds)
    : { data: [], error: null };
  if (namesRes.error) throw new Error(namesRes.error.message);
  return {
    rows,
    total: count || 0,
    materialNames: Object.fromEntries((namesRes.data || []).map((row) => [row.id, row.name])),
  };
}

export async function listCatalog(
  companyId: string,
  opts: { q?: string; category?: string; sub?: string; limit?: number; offset?: number },
) {
  const limit = clampLimit(opts.limit);
  const offset = Math.max(opts.offset || 0, 0);
  const q = sanitizeFilter((opts.q || "").trim().toLowerCase());
  const category = opts.category && opts.category !== "all" ? opts.category : "";
  const sub = opts.sub && opts.sub !== "all" ? opts.sub : "";

  if (!isSupabaseConfigured()) {
    const state = await getCompanyState(companyId);
    const rows = state.materials.filter((row) => {
      if (category && row.category !== category) return false;
      if (sub && row.sub_category !== sub) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        (row.manufacturer || "").toLowerCase().includes(q) ||
        (row.barcode || "").includes(q)
      );
    });
    return {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      categories: Array.from(new Set(state.materials.map((row) => row.category).filter(Boolean))) as string[],
      subcategories: Array.from(
        new Set(
          state.materials
            .filter((row) => !category || row.category === category)
            .map((row) => row.sub_category)
            .filter(Boolean),
        ),
      ) as string[],
      onHand: Object.fromEntries(rows.slice(offset, offset + limit).map((row) => [row.id, onHand(state, row.id)])),
    };
  }

  const supabase = getSupabaseAdmin();
  let query = supabase.from("stockr_materials").select("*", { count: "exact" }).eq("company_id", companyId).order("name");
  if (category) query = query.eq("category", category);
  if (sub) query = query.eq("sub_category", sub);
  if (q) query = query.or(`name.ilike.%${q}%,manufacturer.ilike.%${q}%,barcode.ilike.%${q}%`);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const rows = (data || []).map(mapMaterial);

  const [cats, subs, inv] = await Promise.all([
    supabase.from("stockr_materials").select("category").eq("company_id", companyId),
    supabase
      .from("stockr_materials")
      .select("sub_category")
      .eq("company_id", companyId)
      .not("sub_category", "is", null),
    rows.length
      ? supabase
          .from("stockr_inventory")
          .select("material_id, quantity")
          .eq("company_id", companyId)
          .in(
            "material_id",
            rows.map((row) => row.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const onHandMap: Record<string, number> = {};
  for (const row of inv.data || []) {
    onHandMap[row.material_id] = (onHandMap[row.material_id] || 0) + Number(row.quantity);
  }

  return {
    rows,
    total: count || 0,
    categories: Array.from(new Set((cats.data || []).map((row) => row.category).filter(Boolean))) as string[],
    subcategories: Array.from(
      new Set(
        (subs.data || []).map((item) => item.sub_category).filter(Boolean),
      ),
    ) as string[],
    onHand: onHandMap,
  };
}

export async function lookupMaterials(companyId: string, opts: { barcode?: string; q?: string; limit?: number }) {
  const limit = clampLimit(opts.limit || 20);
  const barcode = (opts.barcode || "").trim();
  const q = sanitizeFilter((opts.q || "").trim().toLowerCase());

  if (!isSupabaseConfigured()) {
    const state = await getCompanyState(companyId);
    if (barcode) {
      const found = state.materials.find(
        (row) => row.barcode === barcode || `STK${row.id.replace(/\W/g, "").slice(-10)}` === barcode,
      );
      return { rows: found ? [found] : [] };
    }
    if (!q) return { rows: state.materials.slice(0, limit) };
    return {
      rows: state.materials
        .filter(
          (row) =>
            row.name.toLowerCase().includes(q) ||
            (row.barcode || "").includes(q) ||
            (row.aliases || []).some((alias) => alias.toLowerCase().includes(q)),
        )
        .slice(0, limit),
    };
  }

  const supabase = getSupabaseAdmin();
  if (barcode) {
    const { data, error } = await supabase
      .from("stockr_materials")
      .select("*")
      .eq("company_id", companyId)
      .eq("barcode", barcode)
      .limit(5);
    if (error) throw new Error(error.message);
    return { rows: (data || []).map(mapMaterial) };
  }

  let query = supabase.from("stockr_materials").select("*").eq("company_id", companyId).order("name").limit(limit);
  if (q) query = query.or(`name.ilike.%${q}%,barcode.ilike.%${q}%,manufacturer.ilike.%${q}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data || []).map(mapMaterial) };
}

export async function listPurchaseOrders(companyId: string, opts: { status?: string; limit?: number; offset?: number }) {
  const limit = clampLimit(opts.limit);
  const offset = Math.max(opts.offset || 0, 0);
  const status = opts.status && opts.status !== "all" ? opts.status : "";

  if (!isSupabaseConfigured()) {
    const state = await getCompanyState(companyId);
    const rows = state.purchaseOrders.filter((row) => !status || row.status === status);
    return { rows: rows.slice(offset, offset + limit), total: rows.length, materials: state.materials.slice(0, 100) };
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("stockr_purchase_orders")
    .select("*", { count: "exact" })
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  const pos = data || [];
  const ids = pos.map((row) => row.id);
  const linesRes = ids.length
    ? await supabase.from("stockr_purchase_order_lines").select("*").eq("company_id", companyId).in("purchase_order_id", ids)
    : { data: [], error: null };
  if (linesRes.error) throw new Error(linesRes.error.message);

  const linesByPo = new Map<string, PurchaseOrder["lines"]>();
  for (const line of linesRes.data || []) {
    const rows = linesByPo.get(line.purchase_order_id) || [];
    rows.push({
      material_id: line.material_id,
      expected_quantity: Number(line.expected_quantity),
      received_quantity: Number(line.received_quantity),
      unit_cost: line.unit_cost == null ? undefined : Number(line.unit_cost),
    });
    linesByPo.set(line.purchase_order_id, rows);
  }

  const materials = await lookupMaterials(companyId, { limit: 100 });
  return {
    rows: pos.map((row) => ({
      id: row.id,
      po_number: row.po_number,
      supplier: row.supplier,
      expected_delivery: row.expected_delivery || undefined,
      status: row.status,
      created_at: row.created_at,
      lines: linesByPo.get(row.id) || [],
    })) as PurchaseOrder[],
    total: count || 0,
    materials: materials.rows,
  };
}

export async function getReports(companyId: string, opts: { from?: string; to?: string }) {
  const stateLike = async () => {
    if (!isSupabaseConfigured()) return getCompanyState(companyId);
    const supabase = getSupabaseAdmin();
    const [locations, materials, inventory, transactions] = await Promise.all([
      supabase.from("stockr_locations").select("*").eq("company_id", companyId),
      supabase.from("stockr_materials").select("id, name, unit_cost").eq("company_id", companyId),
      supabase.from("stockr_inventory").select("material_id, location_id, quantity").eq("company_id", companyId),
      supabase
        .from("stockr_transactions")
        .select("*")
        .eq("company_id", companyId)
        .gte("created_at", opts.from ? `${opts.from}T00:00:00` : "1970-01-01")
        .lte("created_at", opts.to ? `${opts.to}T23:59:59` : "2999-12-31"),
    ]);
    return {
      locations: (locations.data || []) as Location[],
      materials: (materials.data || []).map(mapMaterial),
      inventory: (inventory.data || []).map(mapInventory),
      transactions: (transactions.data || []).map(mapTransaction),
    };
  };

  const data = await stateLike();
  const valuation = data.locations.map((location) => {
    const rows = data.inventory.filter((row) => row.location_id === location.id && row.quantity > 0);
    const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
    const totalValue = rows.reduce((sum, row) => {
      const material = data.materials.find((item) => item.id === row.material_id);
      return sum + row.quantity * (material?.unit_cost || 0);
    }, 0);
    return { location: location.name, type: location.type, totalQty, totalValue };
  });

  const usageMap = new Map<string, { qty: number; value: number }>();
  for (const tx of data.transactions.filter((row) => row.type === "use")) {
    const key = tx.project || "Unassigned";
    const material = data.materials.find((item) => item.id === tx.material_id);
    const current = usageMap.get(key) || { qty: 0, value: 0 };
    current.qty += tx.quantity;
    current.value += tx.quantity * (material?.unit_cost || 0);
    usageMap.set(key, current);
  }

  const shrinkage = data.transactions
    .filter((tx) => tx.type === "shrink")
    .map((tx) => ({
      ...tx,
      materialName: data.materials.find((row) => row.id === tx.material_id)?.name || "Unknown",
      locationName: data.locations.find((row) => row.id === tx.from_location_id)?.name || "",
    }));

  return {
    valuation,
    grand: valuation.reduce((sum, row) => sum + row.totalValue, 0),
    usage: Array.from(usageMap.entries()).sort((a, b) => b[1].value - a[1].value),
    shrinkage,
  };
}

export async function getWorkspaceCounts(companyId: string) {
  const shell = await getWorkspaceShell(companyId);
  return shell.counts;
}
