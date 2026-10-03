import { isCompleteIdentity, isWeakIdentity } from "./identify-photo.ts";
import type { IdentifiedProduct } from "./types.ts";

export function preferScannedIdentity(
  code: string,
  catalogName?: string,
  remote?: IdentifiedProduct | null,
  known?: IdentifiedProduct | null,
): IdentifiedProduct {
  const barcode = code.trim();
  const named = [remote, known].filter((row): row is IdentifiedProduct => Boolean(row && !isWeakIdentity(row)));
  const complete = named.find(isCompleteIdentity);
  if (complete) return { ...complete, barcode: complete.barcode || barcode };
  const best = named[0];
  if (best) {
    return {
      ...best,
      barcode: best.barcode || barcode,
      upc: best.upc || barcode,
      name: best.name || catalogName || `Scanned item ${barcode}`,
    };
  }
  return {
    name: catalogName || "",
    barcode,
    upc: barcode,
    source: "scan",
    description: "No public product record yet. Add it to the catalog and inventory to receive, use, or transfer it.",
  };
}
