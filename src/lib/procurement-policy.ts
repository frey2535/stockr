export const PROCUREMENT_CONTRACT_VERSION = "1.1";

export type ProcurementRequestType = "QUOTE_ONLY" | "PROCUREMENT";

export type ProcurementIntent = {
  id: string;
  request_type: ProcurementRequestType;
  purchasing_authorized: boolean;
  authorization_id?: string | null;
  converted_from_id?: string | null;
  status: string;
};

const QUOTE_ONLY_STATUSES = new Set(["requested", "quoted", "cancelled", "converted"]);
const INVENTORY_MOVE_STATUSES = new Set(["picking", "staged", "in_transit", "fulfilled"]);

export function parseRequestType(value: unknown): ProcurementRequestType | "" {
  const text = String(value || "").trim().toUpperCase();
  if (text === "QUOTE_ONLY" || text === "QUOTE-ONLY" || text === "QUOTE") return "QUOTE_ONLY";
  if (text === "PROCUREMENT" || text === "BUY" || text === "PURCHASE") return "PROCUREMENT";
  return "";
}

export function requireRequestType(value: unknown): ProcurementRequestType {
  const parsed = parseRequestType(value);
  if (!parsed) {
    throw new Error("Choose Quote only or Procurement. Stockr will not infer purchasing intent.");
  }
  return parsed;
}

export function quoteOnlyCannotPurchaseError(intent: Pick<ProcurementIntent, "request_type">) {
  if (intent.request_type === "QUOTE_ONLY") {
    return "Quote-only requests cannot reserve inventory or place orders.";
  }
  return "";
}

export function purchasingAuthorizationError(
  intent: Pick<ProcurementIntent, "request_type" | "purchasing_authorized" | "authorization_id">,
) {
  const quoteError = quoteOnlyCannotPurchaseError(intent);
  if (quoteError) return quoteError;
  if (!intent.purchasing_authorized || !intent.authorization_id) {
    return "Purchasing authorization is required before reservation or ordering. An approved request is not purchasing authorization.";
  }
  return "";
}

export function requestStatusError(intent: Pick<ProcurementIntent, "request_type" | "status">, nextStatus: string) {
  if (intent.request_type === "QUOTE_ONLY" && INVENTORY_MOVE_STATUSES.has(nextStatus)) {
    return "Quote-only requests cannot move, reserve, or fulfill inventory. Convert to procurement and authorize purchasing first.";
  }
  if (intent.request_type === "QUOTE_ONLY" && !QUOTE_ONLY_STATUSES.has(nextStatus) && nextStatus !== "requested") {
    if (nextStatus === "approved") return "";
    return `Quote-only requests cannot enter ${nextStatus.replaceAll("_", " ")}.`;
  }
  return "";
}

export function convertQuoteToProcurement(intent: ProcurementIntent): ProcurementIntent {
  if (intent.request_type !== "QUOTE_ONLY") {
    throw new Error("Only a quote-only request can convert to procurement.");
  }
  return {
    ...intent,
    request_type: "PROCUREMENT",
    purchasing_authorized: false,
    authorization_id: null,
    converted_from_id: intent.id,
    status: "requested",
  };
}

export function authorizePurchasing(intent: ProcurementIntent, authorizationId: string): ProcurementIntent {
  if (intent.request_type !== "PROCUREMENT") {
    throw new Error("Quote-only requests cannot receive purchasing authorization. Convert to procurement first.");
  }
  if (!authorizationId.trim()) {
    throw new Error("Purchasing authorization requires a durable authorization id.");
  }
  return {
    ...intent,
    purchasing_authorized: true,
    authorization_id: authorizationId,
    status: intent.status === "requested" ? "approved" : intent.status,
  };
}

export function observationFromOffer(input: {
  price?: number | null;
  productUrl?: string | null;
  sourceReference?: string | null;
}) {
  const price = input.price == null || Number.isNaN(Number(input.price)) ? null : Number(input.price);
  const hasEvidence = Boolean(String(input.productUrl || "").trim() || String(input.sourceReference || "").trim());
  if (price == null || !hasEvidence) {
    return {
      unit_price: null as number | null,
      price_status: "unavailable" as const,
      note: "No verified supplier price was found. Stockr will not estimate or invent a price.",
    };
  }
  return {
    unit_price: price,
    price_status: "verified" as const,
    note: "",
  };
}

export function rfqDispatchClaim(status: string) {
  if (status === "dispatched" || status === "sent") {
    return "Official RFQ dispatch is owned by Buildr. Stockr does not mark an RFQ sent unless Buildr returns delivery evidence.";
  }
  return "";
}

export function tenantMismatchError(authenticatedCompanyId: string, payloadCompanyId: string) {
  if (String(payloadCompanyId || "").trim() && String(payloadCompanyId).trim() !== String(authenticatedCompanyId).trim()) {
    return "That company does not match this Stockr workspace.";
  }
  return "";
}
