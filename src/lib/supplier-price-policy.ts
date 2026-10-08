import type { IdentifiedProduct, SupplierOffer } from "./types.ts";

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function exactIdentityMatch(product: Partial<IdentifiedProduct>, offer: Partial<SupplierOffer>) {
  const pMpn = normalize(product.mpn);
  const pUpcs = [product.upc, product.barcode].map(normalize).filter(Boolean);
  const oMpn = normalize(offer.mpn);
  const oUpc = normalize(offer.upc);
  if (pMpn && oMpn && pMpn === oMpn) return true;
  if (oUpc && pUpcs.includes(oUpc)) return true;
  return false;
}

export function verifiedPriceHasEvidence(offer: Partial<SupplierOffer>) {
  if (offer.price == null) return true;
  return Boolean(String(offer.source_reference || "").trim() || String(offer.product_url || "").trim());
}
