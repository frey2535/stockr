import { getCompanyState, setCompanyState } from "./db";
import { isSupabaseConfigured } from "./db-config";
import { uid } from "./id";
import { applyCommand } from "./mutations";
import { getSupabaseAdmin } from "./supabase-admin";
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

async function catalog(companyId: string) {
  const state = await getCompanyState(companyId);
  return state.materials.map((row) => ({ id: row.id, name: row.name }));
}

export async function getFieldOps(companyId: string): Promise<FieldOpsPayload> {
  const materials = await catalog(companyId);
  if (!isSupabaseConfigured()) return { ...emptyPayload(), materials };
  const db = getSupabaseAdmin();

  const [zonesR, binsR, reservationsR, requestsR, requestLinesR, sessionsR, countLinesR] =
    await Promise.all([
      db.from("stockr_storage_zones").select("*").eq("company_id", companyId).order("sort_order"),
      db.from("stockr_storage_bins").select("*").eq("company_id", companyId).eq("is_active", true).order("name"),
      db.from("stockr_inventory_reservations").select("*").eq("company_id", companyId).eq("status", "active").order("created_at", { ascending: false }),
      db.from("stockr_material_requests").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(100),
      db.from("stockr_material_request_lines").select("*").eq("company_id", companyId),
      db.from("stockr_cycle_count_sessions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(50),
      db.from("stockr_cycle_count_lines").select("*").eq("company_id", companyId),
    ]);

  for (const result of [zonesR, binsR, reservationsR, requestsR, requestLinesR, sessionsR, countLinesR]) {
    if (!result.error) continue;
    if (isMissingTable(result.error)) return { ...emptyPayload(), materials };
    throw result.error;
  }

  const requestLines = (requestLinesR.data || []) as MaterialRequestLine[];
  const countLines = (countLinesR.data || []) as CycleCountLine[];

  return {
    zones: (zonesR.data || []) as StorageZone[],
    bins: (binsR.data || []) as StorageBin[],
    reservations: (reservationsR.data || []) as InventoryReservation[],
    requests: ((requestsR.data || []) as MaterialRequest[]).map((request) => ({
      ...request,
      lines: requestLines.filter((line) => line.request_id === request.id),
    })),
    countSessions: ((sessionsR.data || []) as CycleCountSession[]).map((session) => ({
      ...session,
      lines: countLines.filter((line) => line.session_id === session.id),
    })),
    materials,
  };
}

export async function createZone(companyId: string, input: { locationId: string; name: string; code?: string }) {
  if (!isSupabaseConfigured()) throw new Error("Storage zones require the production Supabase database.");
  const db = getSupabaseAdmin();
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
  const state = await getCompanyState(companyId);
  const onHand = state.inventory.find(
    (row) => row.material_id === input.materialId && row.location_id === input.locationId,
  )?.quantity || 0;
  const reserved = await getReservedQuantity(companyId, input.materialId, input.locationId);
  const available = Math.max(0, onHand - reserved);
  if (input.quantity <= 0) throw new Error("Reservation quantity must be greater than zero.");
  if (input.quantity > available) throw new Error(`Only ${available} are available after existing reservations.`);

  const row: InventoryReservation = {
    id: uid("res"),
    company_id: companyId,
    material_id: input.materialId,
    location_id: input.locationId,
    project_id: input.projectId || null,
    quantity: input.quantity,
    status: "active",
    notes: input.notes?.trim() || null,
    created_by: actor,
    created_at: new Date().toISOString(),
  };
  const { error } = await getSupabaseAdmin().from("stockr_inventory_reservations").insert(row);
  if (error) throw error;
  return row;
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
  const db = getSupabaseAdmin();
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
  const db = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await db
    .from("stockr_cycle_count_lines")
    .select("id")
    .eq("company_id", companyId)
    .eq("session_id", sessionId)
    .eq("material_id", materialId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    const { error } = await db.from("stockr_cycle_count_lines").update({ counted_quantity: countedQuantity }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("stockr_cycle_count_lines").insert({
      id: uid("ctl"),
      session_id: sessionId,
      company_id: companyId,
      material_id: materialId,
      expected_quantity: 0,
      counted_quantity: countedQuantity,
    });
    if (error) throw error;
  }
}

export async function submitCycleCount(companyId: string, actor: string, sessionId: string) {
  if (!isSupabaseConfigured()) throw new Error("Cycle counts require the production Supabase database.");
  const db = getSupabaseAdmin();
  const { data: session, error: sessionError } = await db
    .from("stockr_cycle_count_sessions")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", sessionId)
    .single();
  if (sessionError) throw sessionError;
  const { data: lines, error: linesError } = await db
    .from("stockr_cycle_count_lines")
    .select("*")
    .eq("company_id", companyId)
    .eq("session_id", sessionId);
  if (linesError) throw linesError;

  let state = await getCompanyState(companyId);
  for (const line of lines || []) {
    if (line.counted_quantity == null) continue;
    const result = applyCommand(
      state,
      {
        type: "applyAction",
        action: {
          type: "count",
          materialId: line.material_id,
          quantity: Number(line.counted_quantity),
          toLocationId: session.location_id,
          notes: `Cycle count ${sessionId}`,
        },
      },
      actor,
    );
    if (result.error) throw new Error(result.error);
    state = result.state;
  }
  await setCompanyState(companyId, state);
  const { error: updateError } = await db
    .from("stockr_cycle_count_sessions")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("id", sessionId);
  if (updateError) throw updateError;
}
