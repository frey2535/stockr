import { materialColumnsToOmit } from "./material-columns.ts";
import { getSupabaseAdmin } from "./supabase-admin.ts";
import type { Material } from "./types.ts";

function writeChunks<T>(rows: T[], size = 100) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size));
  return chunks;
}

export const MATERIAL_BASE_COLUMNS =
  "id, company_id, name, description, category, sub_category, manufacturer, supplier, unit, unit_cost, barcode, reorder_point, min_stock_level, image_url";

export function materialWriteRow(companyId: string, material: Material, omit: string[] = []) {
  const row: Record<string, unknown> = {
    id: material.id,
    company_id: companyId,
    name: material.name,
    description: material.description || "",
    category: material.category || "",
    sub_category: material.sub_category || "",
    manufacturer: material.manufacturer || "",
    supplier: material.supplier || "",
    unit: material.unit || "each",
    unit_cost: material.unit_cost ?? null,
    barcode: material.barcode || "",
    reorder_point: material.reorder_point ?? null,
    min_stock_level: material.min_stock_level ?? null,
    image_url: material.image_url || "",
  };
  if (!omit.includes("mpn")) row.mpn = material.mpn || "";
  if (!omit.includes("upc")) row.upc = material.upc || "";
  if (!omit.includes("supplier_number")) row.supplier_number = material.supplier_number || "";
  if (!omit.includes("aliases")) row.aliases = material.aliases || [];
  return row;
}

async function upsertMaterialBatch(companyId: string, materials: Material[]) {
  const supabase = getSupabaseAdmin();
  let omit: string[] = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await supabase
      .from("stockr_materials")
      .upsert(materials.map((material) => materialWriteRow(companyId, material, omit)));
    if (!error) return { ok: true as const };
    const next = materialColumnsToOmit(error.message);
    if (!next.length || next.every((column) => omit.includes(column))) {
      return { ok: false as const, error: error.message };
    }
    omit = [...new Set([...omit, ...next])];
  }
  return { ok: false as const, error: "Could not save materials." };
}

export async function upsertMaterialRows(companyId: string, materials: Material[]) {
  if (!materials.length) return { ok: true as const };
  for (const batch of writeChunks(materials, 100)) {
    const saved = await upsertMaterialBatch(companyId, batch);
    if (!saved.ok) return saved;
  }
  return { ok: true as const };
}
