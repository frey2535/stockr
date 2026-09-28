import type { MemberRole } from "./types";
import type { StoreCommand } from "./mutations";

const FIELD_COMMANDS = new Set<StoreCommand["type"]>([
  "applyAction",
  "applyBulkActions",
  "applyRestock",
  "receivePurchaseOrder",
]);

const ADMIN_COMMANDS = new Set<StoreCommand["type"]>([
  "updateSettings",
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
  "upsertProject",
  "replaceProjects",
  "createAccessCode",
  "toggleAccessCode",
  "resetDemo",
]);

export function canChangeBilling(role: MemberRole | undefined) {
  return role === "owner" || role === "admin";
}

export function commandAccessError(role: MemberRole | undefined, type: StoreCommand["type"]) {
  if (type === "resetDemo" && role !== "owner") return "Only the company owner can reset workspace data.";
  if (role === "owner" || role === "admin") return "";
  if (ADMIN_COMMANDS.has(type)) return "Only an owner or admin can change company setup.";
  if (FIELD_COMMANDS.has(type) || type === "applyAction") return "";
  return "You do not have permission for that action.";
}
