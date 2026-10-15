import { uid } from "./id";
import { isSupabaseConfigured } from "./db-config";
import { getSupabaseAdmin } from "./supabase-admin";
import { selectAllForCompanySafe } from "./supabase-page";
import { sourceProduct } from "./supplier-intelligence";
import {
  PROCUREMENT_CONTRACT_VERSION,
  authorizePurchasing as authorizeIntent,
  convertQuoteToProcurement as convertIntent,
  observationFromOffer,
  purchasingAuthorizationError,
  requestStatusError,
  requireRequestType,
  tenantMismatchError,
  type ProcurementRequestType,
} from "./procurement-policy";
import type {
  IdentifiedProduct,
  InventoryItem,
  LineAvailability,
  Material,
  MaterialRequest,
  MaterialRequestLine,
  PriceObservation,
  RfqJob,
  Settings,
} from "./types";

function missingSchema(error: { message?: string; code?: string } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST204" ||
    error?.code === "PGRST205" ||
    /schema cache|does not exist|could not find/i.test(message)
  );
}

const RFQ_NOTE =
  "Official RFQ is queued for Buildr. Stockr does not mark supplier RFQs sent without delivery evidence.";

function requestExtras(row: MaterialRequest) {
  return {
    request_type: row.request_type || "PROCUREMENT",
    purchasing_authorized: Boolean(row.purchasing_authorized),
    authorization_id: row.authorization_id || null,
    authorization_by: row.authorization_by || null,
    converted_from_id: row.converted_from_id || null,
    event_id: row.event_id || null,
    buildr_request_id: row.buildr_request_id || null,
    contract_version: row.contract_version || PROCUREMENT_CONTRACT_VERSION,
  };
}

async function loadMaterial(companyId: string, materialId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_materials")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", materialId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Material not found in this company workspace.");
  return data as Material;
}

async function companySettings(companyId: string): Promise<Pick<Settings, "supplier_web_search" | "allow_broad_web_search">> {
  const { data } = await getSupabaseAdmin()
    .from("stockr_companies")
    .select("supplier_web_search, allow_broad_web_search")
    .eq("id", companyId)
    .maybeSingle();
  return {
    supplier_web_search: data?.supplier_web_search !== false,
    allow_broad_web_search: Boolean(data?.allow_broad_web_search),
  };
}

export async function availabilityForLines(
  companyId: string,
  lines: MaterialRequestLine[],
): Promise<LineAvailability[]> {
  const inventory = await selectAllForCompanySafe<InventoryItem>(
    getSupabaseAdmin(),
    "stockr_inventory",
    companyId,
  );
  const reservations = await selectAllForCompanySafe<{ material_id: string; quantity: number; status: string }>(
    getSupabaseAdmin(),
    "stockr_inventory_reservations",
    companyId,
  );
  return lines.map((line) => {
    const onHand = inventory
      .filter((row) => row.material_id === line.material_id)
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const reserved = reservations
      .filter((row) => row.material_id === line.material_id && row.status === "active")
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const available = Math.max(0, onHand - reserved);
    const requested = Number(line.quantity_requested || 0);
    return {
      line_id: line.id,
      material_id: line.material_id,
      requested,
      on_hand: onHand,
      reserved,
      available,
      shortage: Math.max(0, requested - available),
    };
  });
}

export async function collectPriceBaseline(
  companyId: string,
  request: MaterialRequest,
  lines: MaterialRequestLine[],
): Promise<{ observations: PriceObservation[]; rfqJobs: RfqJob[] }> {
  const settings = await companySettings(companyId);
  const observations: PriceObservation[] = [];
  const rfqBySupplier = new Map<string, RfqJob>();
  const now = new Date().toISOString();

  for (const line of lines) {
    const material = await loadMaterial(companyId, line.material_id);
    const product: IdentifiedProduct = {
      name: material.name,
      manufacturer: material.manufacturer,
      category: material.category,
      barcode: material.barcode || "",
      upc: material.upc || material.barcode,
      mpn: material.mpn,
      source: "catalog",
    };
    const sourced = await sourceProduct(companyId, product, {
      supplierWebSearch: settings.supplier_web_search,
      broadWebSearch: settings.allow_broad_web_search,
    });
    for (const match of sourced.preferred) {
      const priced = observationFromOffer({
        price: match.offer?.price,
        productUrl: match.offer?.product_url,
        sourceReference: match.offer?.source_reference,
      });
      observations.push({
        id: uid("pobs"),
        company_id: companyId,
        request_id: request.id,
        line_id: line.id,
        material_id: line.material_id,
        supplier_id: match.supplier.id,
        supplier_name: match.supplier.name,
        product_url: match.offer?.product_url || null,
        source_reference: match.offer?.source_reference || null,
        observed_at: now,
        mpn: match.offer?.mpn || material.mpn || null,
        upc: match.offer?.upc || material.upc || null,
        supplier_sku: match.offer?.supplier_sku || null,
        unit: match.offer?.unit || material.unit,
        pack_qty: null,
        currency: match.offer?.currency || "USD",
        unit_price: priced.unit_price,
        availability: null,
        price_status: priced.price_status,
        note: priced.note || match.note || null,
      });
      if (!rfqBySupplier.has(match.supplier.id)) {
        rfqBySupplier.set(match.supplier.id, {
          id: uid("rfq"),
          company_id: companyId,
          request_id: request.id,
          supplier_id: match.supplier.id,
          supplier_name: match.supplier.name,
          status: "queued_for_official_rfq",
          channel: "buildr_official",
          created_at: now,
          note: RFQ_NOTE,
        });
      }
    }
    if (!sourced.preferred.length) {
      observations.push({
        id: uid("pobs"),
        company_id: companyId,
        request_id: request.id,
        line_id: line.id,
        material_id: line.material_id,
        supplier_name: "",
        observed_at: now,
        unit_price: null,
        price_status: "unavailable",
        note: "No approved supplier is configured. Stockr will not invent a price.",
      });
    }
  }

  await persistObservations(companyId, request.id, observations, [...rfqBySupplier.values()]);
  return { observations, rfqJobs: [...rfqBySupplier.values()] };
}

async function persistObservations(
  companyId: string,
  requestId: string,
  observations: PriceObservation[],
  rfqJobs: RfqJob[],
) {
  const db = getSupabaseAdmin();
  const clearObs = await db.from("stockr_price_observations").delete().eq("company_id", companyId).eq("request_id", requestId);
  if (clearObs.error && !missingSchema(clearObs.error)) throw clearObs.error;
  const clearRfq = await db.from("stockr_rfq_jobs").delete().eq("company_id", companyId).eq("request_id", requestId);
  if (clearRfq.error && !missingSchema(clearRfq.error)) throw clearRfq.error;
  if (observations.length) {
    const obs = await db.from("stockr_price_observations").insert(observations);
    if (obs.error && !missingSchema(obs.error)) throw obs.error;
  }
  if (rfqJobs.length) {
    const rfq = await db.from("stockr_rfq_jobs").insert(rfqJobs);
    if (rfq.error && !missingSchema(rfq.error)) throw rfq.error;
  }
}

export async function loadProcurementExtras(companyId: string, requestIds: string[]) {
  if (!requestIds.length) {
    return { observations: [] as PriceObservation[], rfqJobs: [] as RfqJob[] };
  }
  const db = getSupabaseAdmin();
  const [obs, rfq] = await Promise.all([
    db.from("stockr_price_observations").select("*").eq("company_id", companyId).in("request_id", requestIds),
    db.from("stockr_rfq_jobs").select("*").eq("company_id", companyId).in("request_id", requestIds),
  ]);
  return {
    observations: missingSchema(obs.error) ? [] : ((obs.data || []) as PriceObservation[]),
    rfqJobs: missingSchema(rfq.error) ? [] : ((rfq.data || []) as RfqJob[]),
  };
}

async function persistRequestRow(companyId: string, request: MaterialRequest) {
  const db = getSupabaseAdmin();
  const extras = requestExtras(request);
  const full = { ...request, ...extras, company_id: companyId };
  const first = await db.from("stockr_material_requests").upsert(full);
  if (!first.error) return;
  if (!missingSchema(first.error)) throw first.error;
  const basic = {
    id: request.id,
    company_id: companyId,
    project_id: request.project_id || null,
    destination_location_id: request.destination_location_id || null,
    requested_by: request.requested_by,
    priority: request.priority,
    status: request.status,
    notes: request.notes || null,
    created_at: request.created_at,
  };
  const retry = await db.from("stockr_material_requests").upsert(basic);
  if (retry.error) throw retry.error;
}

export async function attachProcurement(
  companyId: string,
  requests: Array<MaterialRequest & { lines: MaterialRequestLine[] }>,
) {
  const extras = await loadProcurementExtras(
    companyId,
    requests.map((row) => row.id),
  );
  const availability = await availabilityForLines(
    companyId,
    requests.flatMap((request) => request.lines),
  );
  const byLine = new Map(availability.map((row) => [row.line_id, row]));
  return requests.map((request) => ({
    ...request,
    request_type: request.request_type || "PROCUREMENT",
    purchasing_authorized: Boolean(request.purchasing_authorized),
    observations: extras.observations.filter((row) => row.request_id === request.id),
    rfq_jobs: extras.rfqJobs.filter((row) => row.request_id === request.id),
    availability: request.lines.map((line) => byLine.get(line.id)).filter(Boolean) as LineAvailability[],
  }));
}

export async function submitProcurementRequest(
  companyId: string,
  actor: string,
  input: {
    requestType: unknown;
    projectId?: string;
    destinationLocationId?: string;
    priority?: "normal" | "urgent" | "critical";
    notes?: string;
    eventId?: string;
    buildrRequestId?: string;
    payloadCompanyId?: string;
    lines: Array<{ materialId: string; quantity: number }>;
  },
) {
  if (!isSupabaseConfigured()) throw new Error("Material requests require the production Supabase database.");
  const mismatch = tenantMismatchError(companyId, input.payloadCompanyId || "");
  if (mismatch) throw new Error(mismatch);
  const requestType = requireRequestType(input.requestType);
  if (input.eventId) {
    const existing = await getSupabaseAdmin()
      .from("stockr_material_requests")
      .select("*")
      .eq("company_id", companyId)
      .eq("event_id", input.eventId)
      .maybeSingle();
    if (existing.error && !missingSchema(existing.error)) throw existing.error;
    if (existing.data) {
      const { getFieldOps } = await import("./field-ops");
      const fieldOps = await getFieldOps(companyId);
      const found = fieldOps.requests.find((row) => row.id === existing.data.id);
      if (found) return found;
    }
  }
  const { createMaterialRequest } = await import("./field-ops");
  const created = await createMaterialRequest(companyId, actor, {
    projectId: input.projectId,
    destinationLocationId: input.destinationLocationId,
    priority: input.priority,
    notes: input.notes,
    lines: input.lines,
  });
  const request: MaterialRequest = {
    ...created,
    request_type: requestType,
    purchasing_authorized: false,
    authorization_id: null,
    event_id: input.eventId || uid("evt"),
    buildr_request_id: input.buildrRequestId || null,
    contract_version: PROCUREMENT_CONTRACT_VERSION,
  };
  await persistRequestRow(companyId, request);
  const priced = await collectPriceBaseline(companyId, request, created.lines);
  const availability = requestType === "PROCUREMENT" ? await availabilityForLines(companyId, created.lines) : [];
  return {
    ...created,
    ...request,
    observations: priced.observations,
    rfq_jobs: priced.rfqJobs,
    availability,
  };
}

export async function authorizeRequestPurchasing(companyId: string, actor: string, requestId: string) {
  const request = await loadRequest(companyId, requestId);
  const next = authorizeIntent(
    {
      id: request.id,
      request_type: (request.request_type || "PROCUREMENT") as ProcurementRequestType,
      purchasing_authorized: Boolean(request.purchasing_authorized),
      authorization_id: request.authorization_id,
      status: request.status,
    },
    uid("auth"),
  );
  const saved: MaterialRequest = {
    ...request,
    ...next,
    authorization_by: actor,
  };
  await persistRequestRow(companyId, saved);
  return saved;
}

export async function convertRequestToProcurement(companyId: string, requestId: string) {
  const request = await loadRequest(companyId, requestId);
  const next = convertIntent({
    id: request.id,
    request_type: (request.request_type || "QUOTE_ONLY") as ProcurementRequestType,
    purchasing_authorized: Boolean(request.purchasing_authorized),
    authorization_id: request.authorization_id,
    status: request.status,
  });
  const saved: MaterialRequest = { ...request, ...next };
  await persistRequestRow(companyId, saved);
  return saved;
}

export async function assertRequestCanMoveInventory(companyId: string, requestId: string, nextStatus?: string) {
  const request = await loadRequest(companyId, requestId);
  const intent = {
    id: request.id,
    request_type: (request.request_type || "PROCUREMENT") as ProcurementRequestType,
    purchasing_authorized: Boolean(request.purchasing_authorized),
    authorization_id: request.authorization_id,
    status: request.status,
  };
  if (nextStatus) {
    const statusError = requestStatusError(intent, nextStatus);
    if (statusError) throw new Error(statusError);
  }
  if (nextStatus && ["picking", "staged", "in_transit", "fulfilled"].includes(nextStatus)) {
    const authError = purchasingAuthorizationError(intent);
    if (authError) throw new Error(authError);
  }
  return request;
}

async function loadRequest(companyId: string, requestId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_material_requests")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Material request not found in this company workspace.");
  return data as MaterialRequest;
}
