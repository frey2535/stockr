import type { IdentifiedProduct } from "./types.ts";

export function photoFallbackProduct(code = ""): IdentifiedProduct {
  const trimmed = code.trim();
  return {
    name: trimmed ? `Photo item ${trimmed}` : "Item from camera photo",
    barcode: trimmed,
    upc: trimmed.replace(/\D/g, "") || undefined,
    source: "photo",
    description: "No online listing found yet. Name it and add it to the catalog to receive, use, or transfer it.",
  };
}

export function isWeakIdentity(product: IdentifiedProduct | null | undefined) {
  if (!product?.name?.trim()) return true;
  return (
    product.source === "scan" ||
    product.source === "photo" ||
    /^scanned item\b/i.test(product.name) ||
    /^photo item\b/i.test(product.name) ||
    /^item from (camera )?photo/i.test(product.name)
  );
}

export function buildProductSearchQuery(product: Partial<IdentifiedProduct>) {
  return [product.brand, product.manufacturer, product.name, product.mpn, product.barcode]
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function resolvePhotoIdentity(
  barcode: string,
  vision: IdentifiedProduct | null,
  identifyCode: (code: string) => Promise<IdentifiedProduct | null>,
  search: (query: string) => Promise<IdentifiedProduct | null>,
): Promise<IdentifiedProduct> {
  const code = (barcode || vision?.barcode || "").trim();
  let identified = code ? await identifyCode(code) : null;
  const query = vision && !isWeakIdentity(vision) ? buildProductSearchQuery(vision) : "";

  if (isWeakIdentity(identified) && query.length >= 3) {
    const searched = await search(query);
    if (searched) identified = searched;
  }
  if (isWeakIdentity(identified) && vision && !isWeakIdentity(vision)) {
    identified = {
      ...vision,
      barcode: vision.barcode || code,
      upc: vision.upc || vision.barcode || code || undefined,
    };
  }
  if (identified && !isWeakIdentity(identified)) {
    return {
      ...identified,
      barcode: identified.barcode || code,
      upc: identified.upc || identified.barcode || code || undefined,
    };
  }
  return identified?.name ? identified : photoFallbackProduct(code);
}
