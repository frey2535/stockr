import { getCompanyState } from "./db";
import { isSupabaseConfigured } from "./db-config";
import { uid } from "./id";
import { getSupabaseAdmin } from "./supabase-admin";
import { selectAllForCompany, selectAllMatching } from "./supabase-page";
import { attachProcurement, assertRequestCanMoveInventory } from "./procurement";
import type {
  CycleCountLine,
  CycleCountSession,
  FieldOpsPayload,
  InventoryReservation,
  MaterialRequest,
  MaterialRequestLine,
  StorageBin,
  StorageZone,
} from "./types";

function emptyPayload(): FieldOpsPayload {
  return { zones: [], bins: [], reservations: [], requests: [], countSessions: [], materials: [] };
}

function isMissingTable(error: { message?: string; code?: string } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /does not exist|schema cache/i.test(message)
  );
}

async function requireOwnedId(
  db: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  companyId: string,
  id: string,
  label: string,
) {
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("company_id", companyId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${label} not found in this company workspace.`);
}

async function catalog(companyId: string) {
  if (isSupabaseConfigured()) {
    const { selectAllForCompany } = await import("./supabase-page");
    const { getSupabaseAdmin } = await import("./supabase-admin");
    const rows = await selectAllForCompany<{ id: string; name: string }>(
      getSupabaseAdmin(),
      "stockr_materials",
      companyId,
      "id, name",
    );
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }
  const state = await getCompanyState(companyId);
  return state.materials.map((row) => ({ id: row.id, name: row.name }));
}

export async function getFieldOps(companyId: string): Promise<FieldOpsPayload> {
  const materials = await catalog(companyId);
  if (!isSupabaseConfigured()) return { ...emptyPayload(), materials };
  const db = getSupabaseAdmin();

  try {
    const [zones, bins, reservations, requestsR, sessionsR] = await Promise.all([
      selectAllForCompany<StorageZone>(db, "stockr_storage_zones", companyId),
      selectAllMatching<StorageBin>(
        (from, to) =>
          db
            .from("stockr_storage_bins")
            .select("*")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("name")
            .range(from, to),
        "storage bins",
      ),
      selectAllMatching<InventoryReservation>(
        (from, to) =>
          db
            .from("stockr_inventory_reservations")
            .select("*")
            .eq("company_id", companyId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .range(from, to),
        "reservations",
      ),
      db.from("stockr_material_requests").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100),
      db.from("stockr_cycle_count_sessions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
    ]);

    for (const result of [requestsR, sessionsR]) {
      if (!result.error) continue;
      if (isMissingTable(result.error)) return { ...emptyPayload(), materials };
      throw result.error;
    }

    const requests = (requestsR.data || []) as MaterialRequest[];
    const sessions = (sessionsR.data || []) as CycleCountSession[];
    const requestIds = requests.map((row) => row.id);
    const sessionIds = sessions.map((row) => row.id);
    const [requestLines, countLines] = await Promise.all([
      requestIds.length
        ? selectAllMatching<MaterialRequestLine>(
            (from, to) =>
              db
                .from("stockr_material_request_lines")
                .select("*")
                .eq("company_id", companyId)
                .in("request_id", requestIds)
                .range(from, to),
            "request lines",
          )
        : Promise.resolve([]),
      sessionIds.length
        ? selectAllMatching<CycleCountLine>(
            (from, to) =>
              db
                .from("stockr_cycle_count_lines")
                .select("*")
                .eq("company_id", companyId)
                .in("session_id", sessionIds)
                .range(from, to),
            "count lines",
          )
        : Promise.resolve([]),
    ]);

    return {
      zones,
      bins,
      reservations,
      requests: await attachProcurement(
        companyId,
        requests.map((request) => ({
          ...request,
          lines: requestLines.filter((line) => line.request_id === request.id),
        })),
      ),
      countSessions: sessions.map((session) => ({
        ...session,
        lines: countLines.filter((line) => line.session_id === session.id),
      })),
      materials,
    };
  } catch (error) {
    if (isMissingTable(error as { message?: string; code?: string })) return { ...emptyPayload(), materials };
    throw error;
  }
}

export async function createZone(companyId: string, input: { locationId: string; name: string; code?: string }) {
  if (!isSupabaseConfigured()) throw new Error("Storage zones require the production Supabase database.");
  const db = getSupabaseAdmin();
  await requireOwnedId(db, "stockr_locations", companyId, input.locationId, "Location");
  const row: StorageZone = {
    id: uid("zone"),
    company_id: companyId,
    location_id: input.locationId,
    name: input.name.trim(),
    code: input.code?.trim() || null,
    sort_order: 0,
  };
  const { error } = await db.from("stockr_storage_zones").insert(row);
  if (error) throw error;
  return row;
}

export async function createBin(companyId: string, input: {
  locationId: string;
  zoneId?: string;
  name: string;
  code: string;
  barcode?: string;
  description?: string;
}) {
  if (!isSupabaseConfigured()) throw new Error("Storage bins require the production Supabase database.");
  const db = getSupabaseAdmin();
  await requireOwnedId(db, "stockr_locations", companyId, input.locationId, "Location");
  if (input.zoneId) {
    const { data: zone, error: zoneError } = await db
      .from("stockr_storage_zones")
      .select("id, location_id")
      .eq("company_id", companyId)
      .eq("id", input.zoneId)
      .maybeSingle();
    if (zoneError) throw zoneError;
    if (!zone) throw new Error("Zone not found in this company workspace.");
    if (String(zone.location_id) !== input.locationId) {
      throw new Error("Zone does not belong to the selected location.");
    }
  }
  const row: StorageBin = {
    id: uid("bin"),
    company_id: companyId,
    location_id: input.locationId,
    zone_id: input.zoneId || null,
    name: input.name.trim(),
    code: input.code.trim(),
    barcode: input.barcode?.trim() || null,
    description: input.description?.trim() || null,
    is_active: true,
  };
  const { error } = await db.from("stockr_storage_bins").insert(row);
  if (error) throw error;
  return row;
}

export async function createReservation(companyId: string, actor: string, input: {
  materialId: string;
  locationId: string;
  projectId?: string;
  quantity: number;
  notes?: string;
}) {
  if (!isSupabaseConfigured()) throw new Error("Reservations require the production Supabase database.");
  const db = getSupabaseAdmin();
  const reservationId = uid("res");
  const { error } = await db.rpc("stockr_create_inventory_reservation", {
    p_company_id: companyId,
    p_reservation_id: reservationId,
    p_material_id: input.materialId,
    p_location_id: input.locationId,
    p_project_id: input.projectId || null,
    p_quantity: Number(input.quantity),
    p_notes: input.notes || "",
    p_created_by: actor,
  });
  if (error) {
    if (/stockr_create_inventory_reservation|does not exist|schema cache/i.test(error.message)) {
      throw new Error("Production reservation integrity migration is required before creating reservations.");
    }
    throw new Error(error.message);
  }
  const { data, error: loadError } = await db
    .from("stockr_inventory_reservations")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", reservationId)
    .single();
  if (loadError) throw loadError;
  return data as InventoryReservation;
}

export async function releaseReservation(companyId: string, reservationId: string) {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseAdmin()
    .from("stockr_inventory_reservations")
    .update({ status: "released" })
    .eq("company_id", companyId)
    .eq("id", reservationId);
  if (error) throw error;
}

export async function getReservedQuantity(companyId: string, materialId: string, locationId: string) {
  if (!isSupabaseConfigured()) return 0;
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_inventory_reservations")
    .select("quantity")
    .eq("company_id", companyId)
    .eq("material_id", materialId)
    .eq("location_id", locationId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
}

export async function createMaterialRequest(companyId: string, actor: string, input: {
  projectId?: string;
  destinationLocationId?: string;
  priority?: "normal" | "urgent" | "critical";
  notes?: string;
  lines: Array<{ materialId: string; quantity: number }>;
}) {
  if (!isSupabaseConfigured()) throw new Error("Material requests require the production Supabase database.");
  if (!input.lines.length) throw new Error("Add at least one material.");
  const db = getSupabaseAdmin();
  if (input.destinationLocationId) {
    await requireOwnedId(db, "stockr_locations", companyId, input.destinationLocationId, "Destination location");
  }
  if (input.projectId) {
    await requireOwnedId(db, "stockr_projects", companyId, input.projectId, "Project");
  }
  const materialIds = Array.from(new Set(input.lines.map((line) => line.materialId).filter(Boolean)));
  for (const materialId of materialIds) {
    await requireOwnedId(db, "stockr_materials", companyId, materialId, "Material");
  }
  const request: MaterialRequest = {
    id: uid("req"),
    company_id: companyId,
    project_id: input.projectId || null,
    destination_location_id: input.destinationLocationId || null,
    requested_by: actor,
    priority: input.priority || "normal",
    status: "requested",
    notes: input.notes?.trim() || null,
    created_at: new Date().toISOString(),
  };
  const lines: MaterialRequestLine[] = input.lines
    .filter((line) => Number(line.quantity) > 0)
    .map((line) => ({
      id: uid("rql"),
      request_id: request.id,
      company_id: companyId,
      material_id: line.materialId,
      quantity_requested: Number(line.quantity),
      quantity_fulfilled: 0,
    }));
  if (!lines.length) throw new Error("Requested quantities must be greater than zero.");

  const { error: requestError } = await db.from("stockr_material_requests").insert(request);
  if (requestError) throw requestError;
  const { error: linesError } = await db.from("stockr_material_request_lines").insert(lines);
  if (linesError) throw linesError;
  return { ...request, lines };
}

export async function setMaterialRequestStatus(
  companyId: string,
  requestId: string,
  status: MaterialRequest["status"],
) {
  if (!isSupabaseConfigured()) return;
  await assertRequestCanMoveInventory(companyId, requestId, status);
  const { error } = await getSupabaseAdmin()
    .from("stockr_material_requests")
    .update({ status })
    .eq("company_id", companyId)
    .eq("id", requestId);
  if (error) throw error;
}

export async function startCycleCount(companyId: string, actor: string, input: {
  locationId: string;
  zoneId?: string;
  binId?: string;
}) {
  if (!isSupabaseConfigured()) throw new Error("Cycle counts require the production Supabase database.");
  const db = getSupabaseAdmin();
  await requireOwnedId(db, "stockr_locations", companyId, input.locationId, "Location");
  if (input.zoneId) {
    const { data: zone, error: zoneError } = await db
      .from("stockr_storage_zones")
      .select("id, location_id")
      .eq("company_id", companyId)
      .eq("id", input.zoneId)
      .maybeSingle();
    if (zoneError) throw zoneError;
    if (!zone) throw new Error("Zone not found in this company workspace.");
    if (String(zone.location_id) !== input.locationId) throw new Error("Zone does not belong to the selected location.");
  }
  if (input.binId) {
    const { data: bin, error: binError } = await db
      .from("stockr_storage_bins")
      .select("id, location_id, zone_id")
      .eq("company_id", companyId)
      .eq("id", input.binId)
      .maybeSingle();
    if (binError) throw binError;
    if (!bin) throw new Error("Bin not found in this company workspace.");
    if (String(bin.location_id) !== input.locationId) throw new Error("Bin does not belong to the selected location.");
    if (input.zoneId && String(bin.zone_id || "") !== input.zoneId) throw new Error("Bin does not belong to the selected zone.");
  }
  const state = await getCompanyState(companyId);
  const session: CycleCountSession = {
    id: uid("cnt"),
    company_id: companyId,
    location_id: input.locationId,
    zone_id: input.zoneId || null,
    bin_id: input.binId || null,
    status: "open",
    created_by: actor,
    created_at: new Date().toISOString(),
    submitted_at: null,
  };
  const lines: CycleCountLine[] = state.inventory
    .filter((row) => row.location_id === input.locationId)
    .map((row) => ({
      id: uid("ctl"),
      session_id: session.id,
      company_id: companyId,
      material_id: row.material_id,
      expected_quantity: row.quantity,
      counted_quantity: null,
    }));
  const { error: sessionError } = await db.from("stockr_cycle_count_sessions").insert(session);
  if (sessionError) throw sessionError;
  if (lines.length) {
    const { error: lineError } = await db.from("stockr_cycle_count_lines").insert(lines);
    if (lineError) throw lineError;
  }
  return { ...session, lines };
}

export async function updateCycleCountLine(companyId: string, sessionId: string, materialId: string, countedQuantity: number) {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabaseAdmin().rpc("stockr_set_cycle_count_line", {
    p_company_id: companyId,
    p_session_id: sessionId,
    p_line_id: uid("ctl"),
    p_material_id: materialId,
    p_counted_quantity: Number(countedQuantity),
  });
  if (error) {
    if (/stockr_set_cycle_count_line|does not exist|schema cache/i.test(error.message)) {
      throw new Error("Production cycle-count integrity migration is required before editing counts.");
    }
    throw new Error(error.message);
  }
}

export async function submitCycleCount(companyId: string, actor: string, sessionId: string) {
  if (!isSupabaseConfigured()) throw new Error("Cycle counts require the production Supabase database.");
  const { error } = await getSupabaseAdmin().rpc("stockr_submit_cycle_count_once", {
    p_company_id: companyId,
    p_session_id: sessionId,
    p_created_by: actor,
  });
  if (error) {
    if (/stockr_submit_cycle_count_once|does not exist|schema cache/i.test(error.message)) {
      throw new Error("Production cycle-count integrity migration is required before submitting counts.");
    }
    throw new Error(error.message);
  }
}
