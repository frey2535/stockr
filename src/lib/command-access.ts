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
  "upsertTool",
  "deleteTool",
  "setStockRule",
  "deleteStockRule",
]);

const PURCHASING_MANAGE = new Set<StoreCommand["type"]>([
  "createPurchaseOrder",
  "setPurchaseOrderStatus",
  "deletePurchaseOrder",
]);

const WAREHOUSE = new Set<StoreCommand["type"]>([
  "applyAction",
  "applyBulkActions",
]);

const FIELD = new Set<StoreCommand["type"]>([
  "applyAction",
  "applyBulkActions",
  "upsertTool",
]);

export type FieldOpsAction =
  | "createZone"
  | "createBin"
  | "reserve"
  | "releaseReservation"
  | "createRequest"
  | "setRequestStatus"
  | "authorizePurchasing"
  | "convertToProcurement"
  | "collectPrices"
  | "startCount"
  | "countLine"
  | "submitCount";

export function canChangeBilling(role: MemberRole | undefined) {
  return role === "owner" || role === "admin";
}

export function canManagePurchasing(role: MemberRole | undefined) {
  return role === "owner" || role === "admin" || role === "inventory_admin";
}

export function canReceivePurchasing(role: MemberRole | undefined) {
  return canManagePurchasing(role) || role === "warehouse_manager";
}

export function commandAccessError(role: MemberRole | undefined, type: StoreCommand["type"]) {
  if (!role) return "You do not have permission for that action.";
  if (OWNER_ONLY.has(type)) {
    return role === "owner" ? "" : "Only the company owner can reset workspace data.";
  }
  if (role === "owner" || role === "admin") return "";

  if (PURCHASING_MANAGE.has(type)) {
    return role === "inventory_admin"
      ? ""
      : "Only an owner, admin, or inventory admin can manage purchasing.";
  }

  if (type === "receivePurchaseOrder") {
    return role === "inventory_admin" || role === "warehouse_manager"
      ? ""
      : "Only authorized purchasing or warehouse roles can receive purchase orders.";
  }

  if (COMPANY_ADMIN.has(type)) {
    return "Only an owner or admin can change company setup.";
  }

  if (role === "inventory_admin") {
    if (INVENTORY_ADMIN.has(type) || WAREHOUSE.has(type) || type === "applyRestock") return "";
    return "Inventory admins cannot change company-level settings.";
  }

  if (role === "warehouse_manager") {
    if (INVENTORY_ADMIN.has(type) || WAREHOUSE.has(type) || type === "applyRestock") return "";
    return "Warehouse managers cannot change company-level settings or purchasing records.";
  }

  if (role === "foreman") {
    if (WAREHOUSE.has(type) || FIELD.has(type) || type === "applyRestock") return "";
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
  if (action === "authorizePurchasing" || action === "convertToProcurement") {
    return canManagePurchasing(role) ? "" : "Only an owner, admin, or inventory admin can authorize purchasing.";
  }
  if (role === "owner" || role === "admin" || role === "inventory_admin") return "";
  if (role === "viewer") return "This account is read only.";

  if (role === "warehouse_manager") return "";

  if (role === "foreman") {
    if (action === "createRequest" || action === "reserve" || action === "releaseReservation" || action === "collectPrices") return "";
    return "Foremen cannot change warehouse structure, fulfill requests, authorize purchasing, or post cycle counts.";
  }

  if (role === "technician" || role === "member") {
    if (action === "createRequest") return "";
    return "Technicians can request material but cannot manage warehouse operations.";
  }

  return "You do not have permission for that field operation.";
}


export function commandPayloadAccessError(role: MemberRole | undefined, command: StoreCommand) {
  const denied = commandAccessError(role, command.type);
  if (denied) return denied;

  if (command.type === "applyRestock" && command.restock.kind === "draft_po" && !canManagePurchasing(role)) {
    return "Only an owner, admin, or inventory admin can create a draft purchase order.";
  }

  return "";
}
