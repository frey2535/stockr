import { DAY_ONE_CATALOG, DAY_ONE_COMPANY_ID, type DayOneCatalogSeed } from "./dayone-catalog.ts";

export type DayOneCatalogExistingRow = {
  id: string;
  company_id: string;
};

export function shouldBootstrapDayOneCatalog(companyId: string, buildrCompanyId = "") {
  return companyId === DAY_ONE_COMPANY_ID || buildrCompanyId === DAY_ONE_COMPANY_ID;
}

export function dayOneMaterialId(item: Pick<DayOneCatalogSeed, "sku">) {
  return "dayone_" + item.sku.toLowerCase().replace(/-/g, "_");
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
