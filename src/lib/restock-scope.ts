import type { StockRule } from "./types.ts";

export function restockMaterialIds(rules: Pick<StockRule, "material_id">[]) {
  return Array.from(new Set(rules.map((rule) => rule.material_id).filter(Boolean)));
}
