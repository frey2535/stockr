import type { Material } from "./types";

export type CsvMaterialRow = {
  name: string;
  unit: string;
  barcode: string;
  category: string;
  manufacturer: string;
  supplier: string;
  unit_cost: number | null;
  quantity: number;
};

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

export function parseMaterialCsv(text: string): CsvMaterialRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const first = splitCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const looksLikeHeader = first.some((cell) =>
    ["name", "material", "barcode", "sku", "qty", "quantity", "unit"].includes(cell),
  );
  const headers = looksLikeHeader ? first : [];
  const rows = looksLikeHeader ? lines.slice(1) : lines;

  const nameIdx = headerIndex(headers, ["name", "material", "item", "description"]);
  const barcodeIdx = headerIndex(headers, ["barcode", "sku", "upc", "code"]);
  const qtyIdx = headerIndex(headers, ["qty", "quantity", "expected", "count"]);
  const unitIdx = headerIndex(headers, ["unit", "uom"]);
  const categoryIdx = headerIndex(headers, ["category", "cat"]);
  const mfrIdx = headerIndex(headers, ["manufacturer", "mfr", "brand"]);
  const supplierIdx = headerIndex(headers, ["supplier", "vendor"]);
  const costIdx = headerIndex(headers, ["unit_cost", "cost", "price"]);

  return rows
    .map((line) => {
      const cells = splitCsvLine(line);
      const name = (nameIdx >= 0 ? cells[nameIdx] : cells[0]) || "";
      const barcode = (barcodeIdx >= 0 ? cells[barcodeIdx] : cells[1] || "") || "";
      const quantity = Number(qtyIdx >= 0 ? cells[qtyIdx] : cells[2] || 1) || 1;
      return {
        name: name || (barcode ? `Unknown Product - ${barcode}` : ""),
        barcode,
        quantity,
        unit: (unitIdx >= 0 ? cells[unitIdx] : "each") || "each",
        category: (categoryIdx >= 0 ? cells[categoryIdx] : "") || "",
        manufacturer: (mfrIdx >= 0 ? cells[mfrIdx] : "") || "",
        supplier: (supplierIdx >= 0 ? cells[supplierIdx] : "") || "",
        unit_cost: costIdx >= 0 && cells[costIdx] ? Number(cells[costIdx]) || null : null,
      };
    })
    .filter((row) => row.name || row.barcode);
}

export function materialFromCsv(row: CsvMaterialRow): Partial<Material> {
  return {
    name: row.name,
    barcode: row.barcode,
    unit: row.unit || "each",
    category: row.category,
    manufacturer: row.manufacturer,
    supplier: row.supplier,
    unit_cost: row.unit_cost,
  };
}
