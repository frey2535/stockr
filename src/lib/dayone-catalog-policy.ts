import { DAY_ONE_CATALOG, DAY_ONE_COMPANY_ID, type DayOneCatalogSeed } from "./dayone-catalog.ts";

export type DayOneCatalogExistingRow = {
  id: string;
  company_id: string;
};

export function normalizeCompanyName(name: string) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isDayOneCompanyName(name: string) {
  const normalized = normalizeCompanyName(name);
  return normalized === "day one electric" || normalized.startsWith("day one electric ") || normalized === "dayone electric";
}

export function shouldBootstrapDayOneCatalog(companyId: string, buildrCompanyId = "", companyName = "") {
  return (
    companyId === DAY_ONE_COMPANY_ID ||
    buildrCompanyId === DAY_ONE_COMPANY_ID ||
    isDayOneCompanyName(companyName)
  );
}

export function dayOneMaterialId(item: Pick<DayOneCatalogSeed, "sku">) {
  return "dayone_" + item.sku.toLowerCase().replace(/-/g, "_");
}

export function dayOneScopedMaterialId(companyId: string, item: Pick<DayOneCatalogSeed, "sku">) {
  const tenant =
    String(companyId || "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "workspace";
  return "dayone_" + tenant + "_" + item.sku.toLowerCase().replace(/-/g, "_");
}

export function claimableDayOneCompanyIds(
  collisions: DayOneCatalogExistingRow[],
  owners: Array<{ id: string; name?: string | null }>,
) {
  const known = new Set(owners.map((row) => String(row.id)));
  const dayOneOwners = owners
    .filter((row) => shouldBootstrapDayOneCatalog(String(row.id), "", String(row.name || "")))
    .map((row) => String(row.id));
  const orphans = [...new Set(collisions.map((row) => row.company_id))].filter((id) => !known.has(id));
  return [...new Set([...dayOneOwners, ...orphans])];
}

export function dayOneExpectedIds() {
  return DAY_ONE_CATALOG.map(dayOneMaterialId);
}

export function dayOneMissingItems(
  existingRows: DayOneCatalogExistingRow[],
  targetCompanyId: string,
) {
  const expected = new Set(dayOneExpectedIds());
  const relevantRows = existingRows.filter((row) => expected.has(row.id));
  const collisions = relevantRows.filter(
    (row) => row.company_id !== targetCompanyId,
  );
  if (collisions.length) {
    throw new Error(
      "Day One catalog tenant isolation violation: reserved catalog IDs exist outside the resolved Day One workspace.",
    );
  }

  const existingIds = new Set(relevantRows.map((row) => row.id));
  return DAY_ONE_CATALOG.filter((item) => !existingIds.has(dayOneMaterialId(item)));
}

export function chunkRows<T>(rows: T[], size = 100) {
  if (!Number.isInteger(size) || size <= 0) throw new Error("Chunk size must be a positive integer.");
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
