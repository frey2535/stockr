import type { MemberRole } from "./types";
import type { StoreCommand } from "./mutations";

const OWNER_ONLY = new Set<StoreCommand["type"]>(["resetDemo"]);

const COMPANY_ADMIN = new Set<StoreCommand["type"]>([
  "updateSettings",
  "createAccessCode",
  "toggleAccessCode",
  "upsertProject",
  "replaceProjects",
]);

const INVENTORY_ADMIN = new Set<StoreCommand["type"]>([
  "upsertLocation",
  "deleteLocation",
  "upsertMaterial",
  "upsertMaterials",
  "deleteMaterial",
  "deleteTransaction",
  "createPurchaseOrder",
  "setPurchaseOrderStatus",
  "deletePurchaseOrder",
  "upsertTool",
  "deleteTool",
  "setStockRule",
  "deleteStockRule",
]);

const WAREHOUSE = new Set<StoreCommand["type"]>([
  "applyAction",
  "applyBulkActions",
  "applyRestock",
  "receivePurchaseOrder",
]);

const FIELD = new Set<StoreCommand["type"]>([
  "applyAction",
  "applyBulkActions",
]);

export type FieldOpsAction =
  | "createZone"
  | "createBin"
  | "reserve"
  | "releaseReservation"
  | "createRequest"
  | "setRequestStatus"
  | "startCount"
  | "countLine"
  | "submitCount";

export function canChangeBilling(role: MemberRole | undefined) {
  return role === "owner" || role === "admin";
}

export function commandAccessError(role: MemberRole | undefined, type: StoreCommand["type"]) {
  if (!role) return "You do not have permission for that action.";
  if (OWNER_ONLY.has(type)) {
    return role === "owner" ? "" : "Only the company owner can reset workspace data.";
  }
  if (role === "owner" || role === "admin") return "";

  if (COMPANY_ADMIN.has(type)) {
    return "Only an owner or admin can change company setup.";
  }

  if (role === "inventory_admin") {
    if (INVENTORY_ADMIN.has(type) || WAREHOUSE.has(type)) return "";
    return "Inventory admins cannot change company-level settings.";
  }

  if (role === "warehouse_manager") {
    if (INVENTORY_ADMIN.has(type) || WAREHOUSE.has(type)) return "";
    return "Warehouse managers cannot change company-level settings.";
  }

  if (role === "foreman") {
    if (WAREHOUSE.has(type) || FIELD.has(type)) return "";
    return "Foremen do not have permission for that company setup action.";
  }

  if (role === "technician" || role === "member") {
    if (FIELD.has(type)) return "";
    return "Technicians can perform field inventory actions but cannot change company setup.";
  }

  if (role === "viewer") return "This account is read only.";

  return "You do not have permission for that action.";
}

export function fieldOpsAccessError(role: MemberRole | undefined, action: FieldOpsAction) {
  if (!role) return "You do not have permission for that action.";
  if (role === "owner" || role === "admin" || role === "inventory_admin") return "";
  if (role === "viewer") return "This account is read only.";

  if (role === "warehouse_manager") return "";

  if (role === "foreman") {
    if (action === "createRequest" || action === "reserve" || action === "releaseReservation") return "";
    return "Foremen cannot change warehouse structure, fulfill requests, or post cycle counts.";
  }

  if (role === "technician" || role === "member") {
    if (action === "createRequest") return "";
    return "Technicians can request material but cannot manage warehouse operations.";
  }

  return "You do not have permission for that field operation.";
}
