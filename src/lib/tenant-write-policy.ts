export type TenantWriteMode = "create" | "update" | "reject";

export function tenantWriteMode(requestedId: string | undefined, ownedRecordExists: boolean): TenantWriteMode {
  if (!requestedId) return "create";
  return ownedRecordExists ? "update" : "reject";
}

export function assertTenantWriteAllowed(requestedId: string | undefined, ownedRecordExists: boolean, label: string) {
  const mode = tenantWriteMode(requestedId, ownedRecordExists);
  if (mode === "reject") {
    throw new Error(`${label} not found in this company workspace.`);
  }
  return mode;
}
