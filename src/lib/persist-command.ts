import { createEmptyState } from "./seed";
import { applyCommand, type StoreCommand } from "./mutations";
import { isSupabaseConfigured } from "./db-config";
import { encodeStateForPersist } from "./persist-state";
import { getSupabaseAdmin } from "./supabase-admin";
import { selectAllForCompany, selectAllForCompanySafe } from "./supabase-page";
import { encodeToolsForPersist, isToolsBlob, mergeToolLists, toolsFromProjects } from "./tools-state";
import { uid } from "./id";
import { needsProject } from "./tx";
import type { AccessCode, InventoryAction, Material, Project, PurchaseOrder, Tool, Transaction } from "./types";

export type PersistResult = {
  error?: string;
  created?: Material | AccessCode | Tool;
};

function fail(message: string): PersistResult {
  return { error: message };
}

function throwIfError(error: { message: string } | null, action: string) {
  if (error) throw new Error(`${action}: ${error.message}`);
}

function materialRow(companyId: string, material: Material) {
  return {
    id: material.id,
    company_id: companyId,
    name: material.name,
    description: material.description || "",
    category: material.category || "",
    sub_category: material.sub_category || "",
    manufacturer: material.manufacturer || "",
    supplier: material.supplier || "",
    unit: material.unit || "each",
    unit_cost: material.unit_cost ?? null,
    barcode: material.barcode || "",
    mpn: material.mpn || "",
    upc: material.upc || "",
    supplier_number: material.supplier_number || "",
    reorder_point: material.reorder_point ?? null,
    min_stock_level: material.min_stock_level ?? null,
    image_url: material.image_url || "",
    aliases: material.aliases || [],
  };
}

function toolRow(companyId: string, tool: Tool, includeExtras = true) {
  return {
    id: tool.id,
    company_id: companyId,
    name: tool.name,
    description: tool.description || "",
    category: tool.category || "",
    barcode: tool.barcode || "",
    assigned_location_id: tool.assigned_location_id || "",
    assigned_to: tool.assigned_to || "",
    status: tool.status || "available",
    ...(includeExtras
      ? {
          tool_number: tool.tool_number || "",
          condition: tool.condition || "good",
        }
      : {}),
  };
}

async function upsertToolRow(companyId: string, tool: Tool) {
  const supabase = getSupabaseAdmin();
  const full = await supabase.from("stockr_tools").upsert(toolRow(companyId, tool, true));
  if (!full.error) return true;
  if (!/tool_number|condition|column|schema cache|does not exist/i.test(full.error.message)) {
    console.error("Save tool", full.error.message);
  }
  const basic = await supabase.from("stockr_tools").upsert(toolRow(companyId, tool, false));
  if (basic.error) {
    console.error("Save tool", basic.error.message);
    return false;
  }
  return true;
}

async function persistToolsFallback(companyId: string, tools: Tool[], projects: Project[]) {
  const supabase = getSupabaseAdmin();
  const encoded = encodeToolsForPersist({
    ...createEmptyState("tmp"),
    tools,
    projects,
  });
  const blob = encoded.projects.find(isToolsBlob);
  if (!blob) return;
  const { error } = await supabase.from("stockr_projects").upsert({
    id: blob.id,
    company_id: companyId,
    name: blob.name,
    project_number: blob.project_number || "",
    status: blob.status,
  });
  if (error) throw new Error(`Save tools: ${error.message}`);
}

function missingRpc(error: { message?: string; code?: string } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42883" ||
    error?.code === "PGRST202" ||
    /stockr_bump_inventory|stockr_set_inventory|does not exist|schema cache/i.test(message)
  );
}

async function bumpRows(companyId: string, materialId: string, locationId: string, delta: number) {
  const supabase = getSupabaseAdmin();
  const loaded = await supabase
    .from("stockr_inventory")
    .select("id, quantity")
    .eq("company_id", companyId)
    .eq("material_id", materialId)
    .eq("location_id", locationId)
    .maybeSingle();
  throwIfError(loaded.error, "Load inventory");
  const current = loaded.data ? Number(loaded.data.quantity) : 0;
  const next = current + delta;
  if (next < 0) return "Not enough quantity on hand.";
  if (!loaded.data) {
    if (delta <= 0) return "Not enough quantity on hand.";
    const insert = await supabase.from("stockr_inventory").insert({
      id: `inv_${companyId}_${materialId}_${locationId}`,
      company_id: companyId,
      material_id: materialId,
      location_id: locationId,
      quantity: next,
    });
    throwIfError(insert.error, "Create inventory");
    return "";
  }
  if (next === 0) {
    const del = await supabase
      .from("stockr_inventory")
      .delete()
      .eq("id", loaded.data.id)
      .eq("company_id", companyId);
    throwIfError(del.error, "Clear inventory");
    return "";
  }
  const update = await supabase
    .from("stockr_inventory")
    .update({ quantity: next })
    .eq("id", loaded.data.id)
    .eq("company_id", companyId);
  throwIfError(update.error, "Update inventory");
  return "";
}

async function bump(companyId: string, materialId: string, locationId: string, delta: number) {
  const { error } = await getSupabaseAdmin().rpc("stockr_bump_inventory", {
    p_company_id: companyId,
    p_material_id: materialId,
    p_location_id: locationId,
    p_delta: delta,
  });
  if (!error) return "";
  if (/not enough/i.test(error.message)) return error.message;
  if (missingRpc(error)) return bumpRows(companyId, materialId, locationId, delta);
  throw new Error(`Update inventory: ${error.message}`);
}

async function setQty(companyId: string, materialId: string, locationId: string, quantity: number) {
  const { error } = await getSupabaseAdmin().rpc("stockr_set_inventory", {
    p_company_id: companyId,
    p_material_id: materialId,
    p_location_id: locationId,
    p_quantity: quantity,
  });
  if (!error) return;
  if (!missingRpc(error)) throwIfError(error, "Set inventory");
  if (quantity <= 0) {
    const del = await getSupabaseAdmin()
      .from("stockr_inventory")
      .delete()
      .eq("company_id", companyId)
      .eq("material_id", materialId)
      .eq("location_id", locationId);
    throwIfError(del.error, "Clear inventory");
    return;
  }
  const { error: upsertError } = await getSupabaseAdmin().from("stockr_inventory").upsert({
    id: `inv_${companyId}_${materialId}_${locationId}`,
    company_id: companyId,
    material_id: materialId,
    location_id: locationId,
    quantity,
  });
  throwIfError(upsertError, "Set inventory");
}

async function insertTransaction(companyId: string, tx: Transaction) {
  const { error } = await getSupabaseAdmin().from("stockr_transactions").insert({
    id: tx.id,
    company_id: companyId,
    type: tx.type,
    material_id: tx.material_id,
    quantity: tx.quantity,
    from_location_id: tx.from_location_id || null,
    to_location_id: tx.to_location_id || null,
    project: tx.project || null,
    notes: tx.notes || "",
    created_at: tx.created_at,
    created_by: tx.created_by,
  });
  throwIfError(error, "Record activity");
}

function actionTx(action: InventoryAction, actor: string): Transaction {
  return {
    id: uid("tx"),
    type: action.type,
    material_id: action.materialId,
    quantity: Number(action.quantity),
    from_location_id: action.fromLocationId || null,
    to_location_id: action.toLocationId || null,
    project: action.project || null,
    notes: action.notes || "",
    created_at: new Date().toISOString(),
    created_by: actor,
  };
}

async function persistAction(companyId: string, action: InventoryAction, actor: string): Promise<PersistResult> {
  const qty = Number(action.quantity);
  if (!action.materialId) return fail("Select a material.");
  if (!Number.isFinite(qty) || qty < 0 || (qty === 0 && action.type !== "adjust" && action.type !== "count")) {
    return fail(action.type === "adjust" || action.type === "count" ? "Quantity cannot be negative." : "Quantity must be greater than zero.");
  }
  if (needsProject(action.type) && !String(action.project || "").trim()) {
    return fail("Job / project is required.");
  }

  const tx = actionTx(action, actor);
  const { error } = await getSupabaseAdmin().rpc("stockr_apply_inventory_action", {
    p_company_id: companyId,
    p_tx_id: tx.id,
    p_type: action.type,
    p_material_id: action.materialId,
    p_quantity: qty,
    p_from_location_id: action.fromLocationId || null,
    p_to_location_id: action.toLocationId || null,
    p_project: action.project || "",
    p_notes: action.notes || "",
    p_created_by: actor,
  });

  if (!error) return {};
  if (/not enough/i.test(error.message)) return fail("Not enough quantity on hand.");
  if (/does not belong to this company/i.test(error.message)) {
    return fail("That material or location is not available in this company workspace.");
  }
  if (missingRpc(error) || /stockr_apply_inventory_action/i.test(error.message)) {
    throw new Error(
      "Production inventory migration is required. Run the latest supabase/schema.sql before accepting inventory changes.",
    );
  }
  throw new Error(`Update inventory: ${error.message}`);
}

async function upsertLocation(companyId: string, command: Extract<StoreCommand, { type: "upsertLocation" }>) {
  const supabase = getSupabaseAdmin();
  if (command.location.id) {
    const { error } = await supabase
      .from("stockr_locations")
      .update({
        name: command.location.name,
        type: command.location.type,
        description: command.location.description || "",
        assigned_to: command.location.assigned_to || "",
      })
      .eq("id", command.location.id)
      .eq("company_id", companyId);
    throwIfError(error, "Update location");
    return {};
  }
  const created = {
    id: uid("loc"),
    company_id: companyId,
    name: command.location.name || "Untitled",
    type: command.location.type || "warehouse",
    description: command.location.description || "",
    assigned_to: command.location.assigned_to || "",
  };
  const { error } = await supabase.from("stockr_locations").insert(created);
  throwIfError(error, "Create location");
  return {};
}

async function persistMaterial(companyId: string, material: Partial<Material> & { id?: string }) {
  const supabase = getSupabaseAdmin();
  let existing: Material | undefined;
  if (material.id) {
    const loaded = await supabase
      .from("stockr_materials")
      .select("*")
      .eq("id", material.id)
      .eq("company_id", companyId)
      .maybeSingle();
    throwIfError(loaded.error, "Load material");
    if (loaded.data) existing = loaded.data as Material;
  }
  const result = applyCommand(
    { ...createEmptyState("tmp"), materials: existing ? [existing] : [] },
    { type: "upsertMaterial", material },
    "system",
  );
  if (result.error || !result.created || !("unit" in result.created)) {
    return fail(result.error || "Could not save the material.");
  }
  const saved = result.created as Material;
  const { error } = await supabase.from("stockr_materials").upsert(materialRow(companyId, saved));
  throwIfError(error, "Save material");
  return { created: saved };
}

async function upsertPurchaseOrder(companyId: string, po: PurchaseOrder) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("stockr_purchase_orders").upsert({
    id: po.id,
    company_id: companyId,
    po_number: po.po_number,
    supplier: po.supplier,
    expected_delivery: po.expected_delivery || null,
    status: po.status,
    created_at: po.created_at,
  });
  throwIfError(error, "Save purchase order");
  await supabase.from("stockr_purchase_order_lines").delete().eq("purchase_order_id", po.id).eq("company_id", companyId);
  if (po.lines.length) {
    const lines = await supabase.from("stockr_purchase_order_lines").insert(
      po.lines.map((line) => ({
        purchase_order_id: po.id,
        company_id: companyId,
        material_id: line.material_id,
        expected_quantity: line.expected_quantity,
        received_quantity: line.received_quantity,
        unit_cost: line.unit_cost ?? null,
      })),
    );
    throwIfError(lines.error, "Save purchase order lines");
  }
}

async function loadPurchaseOrder(companyId: string, poId: string): Promise<PurchaseOrder | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("stockr_purchase_orders")
    .select("*")
    .eq("id", poId)
    .eq("company_id", companyId)
    .maybeSingle();
  throwIfError(error, "Load purchase order");
  if (!data) return null;
  const lines = await supabase
    .from("stockr_purchase_order_lines")
    .select("*")
    .eq("purchase_order_id", poId)
    .eq("company_id", companyId);
  throwIfError(lines.error, "Load purchase order lines");
  return {
    id: data.id,
    po_number: data.po_number,
    supplier: data.supplier,
    expected_delivery: data.expected_delivery || undefined,
    status: data.status,
    created_at: data.created_at,
    lines: (lines.data || []).map((line) => ({
      material_id: line.material_id,
      expected_quantity: Number(line.expected_quantity),
      received_quantity: Number(line.received_quantity),
      unit_cost: line.unit_cost == null ? undefined : Number(line.unit_cost),
    })),
  };
}

async function persistOnSupabase(
  companyId: string,
  command: StoreCommand,
  actor: string,
  seed: ReturnType<typeof createEmptyState> | undefined,
): Promise<PersistResult> {
  const supabase = getSupabaseAdmin();

  if (command.type === "updateSettings") {
    const patch: Record<string, unknown> = {};
    if (command.patch.company_name != null) patch.name = command.patch.company_name;
    if (command.patch.logo_url != null) patch.logo_url = command.patch.logo_url;
    if (command.patch.primary_color != null) patch.primary_color = command.patch.primary_color;
    if (command.patch.accent_color != null) patch.accent_color = command.patch.accent_color;
    if (command.patch.buildr_linked != null) patch.buildr_linked = command.patch.buildr_linked;
    if (command.patch.buildr_company_id != null) patch.buildr_company_id = command.patch.buildr_company_id;
    if (command.patch.supplier_web_search != null) patch.supplier_web_search = command.patch.supplier_web_search;
    if (command.patch.allow_broad_web_search != null) patch.allow_broad_web_search = command.patch.allow_broad_web_search;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from("stockr_companies").update(patch).eq("id", companyId);
      throwIfError(error, "Update settings");
    }
    return {};
  }

  if (command.type === "upsertLocation") return upsertLocation(companyId, command);

  if (command.type === "deleteLocation") {
    await supabase.from("stockr_inventory").delete().eq("company_id", companyId).eq("location_id", command.id);
    const { error } = await supabase.from("stockr_locations").delete().eq("id", command.id).eq("company_id", companyId);
    throwIfError(error, "Delete location");
    return {};
  }

  if (command.type === "upsertMaterial") return persistMaterial(companyId, command.material);

  if (command.type === "upsertMaterials") {
    let created: Material | undefined;
    for (const material of command.materials) {
      const result = await persistMaterial(companyId, material);
      if (result.error) return result;
      created = (result.created as Material) || created;
    }
    return created ? { created } : {};
  }

  if (command.type === "deleteMaterial") {
    await supabase.from("stockr_inventory").delete().eq("company_id", companyId).eq("material_id", command.id);
    const { error } = await supabase.from("stockr_materials").delete().eq("id", command.id).eq("company_id", companyId);
    throwIfError(error, "Delete material");
    return {};
  }

  if (command.type === "applyAction") return persistAction(companyId, command.action, actor);

  if (command.type === "applyBulkActions") {
    if (!command.actions.length) return fail("Add at least one line.");
    for (const [index, action] of command.actions.entries()) {
      const result = await persistAction(companyId, action, actor);
      if (result.error) return fail(`Line ${index + 1}: ${result.error}`);
    }
    return {};
  }

  if (command.type === "deleteTransaction") {
    const { error } = await supabase
      .from("stockr_transactions")
      .delete()
      .eq("id", command.id)
      .eq("company_id", companyId);
    throwIfError(error, "Delete activity");
    return {};
  }

  if (command.type === "createPurchaseOrder") {
    const po: PurchaseOrder = {
      ...command.po,
      id: uid("po"),
      status: command.po.status || "ordered",
      created_at: new Date().toISOString(),
    };
    await upsertPurchaseOrder(companyId, po);
    return {};
  }

  if (command.type === "receivePurchaseOrder") {
    if (!command.receipts.length) return fail("Add at least one receipt quantity.");
    const receipts = command.receipts
      .filter((receipt) => Number(receipt.quantity) > 0)
      .map((receipt) => ({
        tx_id: uid("tx"),
        material_id: receipt.material_id,
        quantity: Number(receipt.quantity),
      }));
    if (!receipts.length) return fail("Receipt quantities must be greater than zero.");

    const { error } = await supabase.rpc("stockr_receive_purchase_order", {
      p_company_id: companyId,
      p_po_id: command.poId,
      p_location_id: command.locationId,
      p_receipts: receipts,
      p_created_by: actor,
    });
    if (!error) return {};
    if (/not found|does not belong/i.test(error.message)) return fail(error.message);
    if (/stockr_receive_purchase_order|does not exist|schema cache/i.test(error.message)) {
      throw new Error(
        "Production purchase-order migration is required. Run the latest supabase/schema.sql before receiving material.",
      );
    }
    throw new Error(`Receive purchase order: ${error.message}`);
  }

  if (command.type === "setPurchaseOrderStatus") {
    const { error } = await supabase
      .from("stockr_purchase_orders")
      .update({ status: command.status })
      .eq("id", command.poId)
      .eq("company_id", companyId);
    throwIfError(error, "Update purchase order");
    return {};
  }

  if (command.type === "deletePurchaseOrder") {
    await supabase.from("stockr_purchase_order_lines").delete().eq("purchase_order_id", command.poId).eq("company_id", companyId);
    const { error } = await supabase
      .from("stockr_purchase_orders")
      .delete()
      .eq("id", command.poId)
      .eq("company_id", companyId);
    throwIfError(error, "Delete purchase order");
    return {};
  }

  if (command.type === "upsertTool" || command.type === "deleteTool") {
    const [tableTools, projects] = await Promise.all([
      selectAllForCompanySafe<Tool>(supabase, "stockr_tools", companyId),
      selectAllForCompanySafe<Project>(supabase, "stockr_projects", companyId),
    ]);
    const prev = {
      ...createEmptyState("tmp"),
      tools: mergeToolLists(tableTools, toolsFromProjects(projects)),
      projects,
    };
    const result = applyCommand(prev, command, actor);
    if (result.error) return fail(result.error);
    if (command.type === "deleteTool") {
      const del = await supabase.from("stockr_tools").delete().eq("id", command.id).eq("company_id", companyId);
      if (del.error) console.error("Delete tool", del.error.message);
      await persistToolsFallback(companyId, result.state.tools, prev.projects);
      return {};
    }
    const saved = result.created as Tool | undefined;
    const tool = saved || result.state.tools.find((row) => row.id === command.tool.id);
    if (!tool) return fail("Could not save the tool.");
    const savedToTable = await upsertToolRow(companyId, tool);
    let savedToBlob = false;
    try {
      await persistToolsFallback(companyId, result.state.tools, prev.projects);
      savedToBlob = true;
    } catch (error) {
      console.error("Backup tool persist", error);
    }
    if (!savedToTable && !savedToBlob) return fail("Could not save the tool to the company workspace.");
    return { created: tool };
  }

  if (
    command.type === "setStockRule" ||
    command.type === "deleteStockRule" ||
    command.type === "upsertProject" ||
    command.type === "replaceProjects"
  ) {
    const projects = await selectAllForCompany<Project>(supabase, "stockr_projects", companyId);
    const prev = {
      ...createEmptyState("tmp"),
      projects,
    };
    const { decodeOpsFromPersist } = await import("./ops-state");
    const decoded = decodeOpsFromPersist(prev);
    const result = applyCommand(decoded, command, actor);
    if (result.error) return fail(result.error);
    const encoded = encodeStateForPersist(result.state);
    const nextIds = new Set(encoded.projects.map((row) => row.id));
    for (const row of prev.projects) {
      if (!nextIds.has(row.id)) {
        await supabase.from("stockr_projects").delete().eq("id", row.id).eq("company_id", companyId);
      }
    }
    if (encoded.projects.length) {
      const { error } = await supabase.from("stockr_projects").upsert(
        encoded.projects.map((row) => ({
          id: row.id,
          company_id: companyId,
          name: row.name,
          project_number: row.project_number || "",
          status: row.status,
        })),
      );
      throwIfError(error, "Save jobs");
    }
    return {};
  }

  if (command.type === "applyRestock") {
    const restock = command.restock;
    if (restock.kind === "transfer") {
      return persistAction(
        companyId,
        {
          type: "transfer",
          materialId: restock.materialId,
          quantity: restock.quantity,
          fromLocationId: restock.fromLocationId,
          toLocationId: restock.locationId,
          notes: "Truck restock",
        },
        actor,
      );
    }
    const materialRes = await supabase
      .from("stockr_materials")
      .select("*")
      .eq("id", restock.materialId)
      .eq("company_id", companyId)
      .maybeSingle();
    throwIfError(materialRes.error, "Load material");
    if (!materialRes.data) return fail("Material not found.");
    const pos = await supabase
      .from("stockr_purchase_orders")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "draft")
      .eq("supplier", restock.supplier || materialRes.data.supplier || "Supplier");
    throwIfError(pos.error, "Load draft purchase orders");
    const draft = pos.data?.[0];
    const loaded = draft ? await loadPurchaseOrder(companyId, draft.id) : null;
    const prev = {
      ...createEmptyState("tmp"),
      materials: [materialRes.data as Material],
      purchaseOrders: loaded ? [loaded] : [],
    };
    const result = applyCommand(prev, command, actor);
    if (result.error) return fail(result.error);
    const next = result.state.purchaseOrders[0];
    if (next) await upsertPurchaseOrder(companyId, next);
    return {};
  }

  if (command.type === "createAccessCode" || command.type === "toggleAccessCode") {
    const codes = await selectAllForCompany<AccessCode>(supabase, "stockr_access_codes", companyId);
    const prev = { ...createEmptyState("tmp"), accessCodes: codes };
    const result = applyCommand(prev, command, actor);
    if (result.error) return fail(result.error);
    const saved =
      command.type === "createAccessCode"
        ? (result.created as AccessCode)
        : result.state.accessCodes.find((row) => row.id === command.id);
    if (!saved) return fail("Could not save the invite code.");
    const { error } = await supabase.from("stockr_access_codes").upsert({
      id: saved.id,
      company_id: companyId,
      code: saved.code,
      type: saved.type,
      label: saved.label,
      expires_at: saved.expires_at || null,
      is_active: saved.is_active,
      created_at: saved.created_at,
    });
    throwIfError(error, "Save invite code");
    return { created: command.type === "createAccessCode" ? saved : undefined };
  }

  if (command.type === "resetDemo") {
    const { setCompanyState } = await import("./db");
    await setCompanyState(companyId, seed || createEmptyState("Company"));
    return {};
  }

  return fail("Unknown command.");
}

export async function persistStoreCommand(
  companyId: string,
  command: StoreCommand,
  actor: string,
  seed?: ReturnType<typeof createEmptyState>,
): Promise<PersistResult> {
  if (!isSupabaseConfigured()) {
    const db = await import("./db");
    const prev = await db.getCompanyState(companyId);
    const result = applyCommand(prev, command, actor, seed);
    if (!result.error) await db.setCompanyState(companyId, result.state);
    return result;
  }
  return persistOnSupabase(companyId, command, actor, seed);
}
