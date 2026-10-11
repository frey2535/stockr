import assert from "node:assert/strict";
import test from "node:test";
import { catalogImportIdentity, validateCatalogImportRows } from "./catalog-import.ts";
import type { CsvMaterialRow } from "./csv.ts";

function row(patch: Partial<CsvMaterialRow> = {}): CsvMaterialRow {
  return {
    name: "Generic trade item",
    unit: "each",
    barcode: "",
    mpn: "",
    upc: "",
    supplier_number: "",
    category: "General",
    sub_category: "",
    description: "",
    manufacturer: "",
    supplier: "",
    unit_cost: null,
    unit_cost_raw: "",
    reorder_point: null,
    min_stock_level: null,
    image_url: "",
    quantity: 1,
    ...patch,
  };
}

test("catalog import identity prioritizes strong product identifiers", () => {
  assert.equal(catalogImportIdentity(row({ upc: "012345678905", barcode: "OTHER" })), "upc:012345678905");
  assert.equal(catalogImportIdentity(row({ barcode: "ABC-123" })), "barcode:abc123");
  assert.equal(
    catalogImportIdentity(row({ manufacturer: "Acme Co.", mpn: "V-100" })),
    "mpn:acmeco:v100",
  );
  assert.equal(
    catalogImportIdentity(row({ supplier: "Trade Supply", supplier_number: "S-44" })),
    "supplier:tradesupply:s44",
  );
});

test("priced catalog rows require a verified supplier source", () => {
  const result = validateCatalogImportRows(
    [row({ unit_cost: 12.34, unit_cost_raw: "12.34" })],
    { supplierSelected: false },
  );
  assert.equal(result.ok, false);
  assert.match(result.errors[0]?.message || "", /approved supplier/i);

  const verified = validateCatalogImportRows(
    [row({ unit_cost: 12.34, unit_cost_raw: "12.34" })],
    { supplierSelected: true },
  );
  assert.equal(verified.ok, true);
  assert.equal(verified.pricedRows, 1);
});

test("invalid or negative price cells are rejected instead of becoming fake prices", () => {
  for (const value of ["not-a-price", "-1"]) {
    const result = validateCatalogImportRows(
      [row({ unit_cost: null, unit_cost_raw: value })],
      { supplierSelected: true },
    );
    assert.equal(result.ok, false);
    assert.match(result.errors[0]?.message || "", /valid non-negative number/i);
  }
});

test("duplicate strong identities in one file are rejected before import", () => {
  const result = validateCatalogImportRows(
    [row({ upc: "111" }), row({ name: "Second row", upc: "111" })],
    { supplierSelected: false },
  );
  assert.equal(result.ok, false);
  assert.match(result.errors[0]?.message || "", /Duplicate product identity/i);
});

test("enterprise import supports files with thousands of rows", () => {
  const rows = Array.from({ length: 5_000 }, (_, index) =>
    row({ name: "Item " + index, upc: String(100000000000 + index) }),
  );
  const result = validateCatalogImportRows(rows, { supplierSelected: false, maxRows: 10_000 });
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});
