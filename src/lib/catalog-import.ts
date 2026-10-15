import type { CsvMaterialRow } from "./csv.ts";

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function catalogImportIdentity(row: CsvMaterialRow) {
  if (normalize(row.upc)) return "upc:" + normalize(row.upc);
  if (normalize(row.barcode)) return "barcode:" + normalize(row.barcode);
  if (normalize(row.mpn) && normalize(row.manufacturer)) {
    return "mpn:" + normalize(row.manufacturer) + ":" + normalize(row.mpn);
  }
  if (normalize(row.supplier_number) && normalize(row.supplier)) {
    return "supplier:" + normalize(row.supplier) + ":" + normalize(row.supplier_number);
  }
  return "";
}

export type CatalogImportValidation = {
  ok: boolean;
  errors: Array<{ row: number; message: string }>;
  pricedRows: number;
};

export function validateCatalogImportRows(
  rows: CsvMaterialRow[],
  options: { supplierSelected: boolean; maxRows?: number } = { supplierSelected: false },
): CatalogImportValidation {
  const errors: Array<{ row: number; message: string }> = [];
  const identities = new Map<string, number>();
  const maxRows = options.maxRows ?? 10_000;
  let pricedRows = 0;

  if (!rows.length) {
    return { ok: false, errors: [{ row: 0, message: "No catalog rows were found." }], pricedRows: 0 };
  }
  if (rows.length > maxRows) {
    errors.push({ row: 0, message: `This import has ${rows.length} rows. Split it into files of ${maxRows} rows or fewer.` });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // account for CSV header
    if (!row.name.trim()) {
      errors.push({ row: rowNumber, message: "Material name is required." });
    }

    if (row.unit_cost_raw?.trim()) {
      const parsed = Number(row.unit_cost_raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.push({ row: rowNumber, message: "Price must be a valid non-negative number." });
      } else {
        pricedRows += 1;
        if (!options.supplierSelected) {
          errors.push({
            row: rowNumber,
            message: "This row contains a price. Select an approved supplier so Stockr can preserve verified price provenance.",
          });
        }
      }
    }

    const identity = catalogImportIdentity(row);
    if (identity) {
      const previous = identities.get(identity);
      if (previous != null) {
        errors.push({
          row: rowNumber,
          message: `Duplicate product identity in this file; first occurrence is CSV row ${previous}.`,
        });
      } else {
        identities.set(identity, rowNumber);
      }
    }
  });

  return { ok: errors.length === 0, errors, pricedRows };
}
