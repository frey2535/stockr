import type { IdentifiedProduct } from "./types";

type KnownProduct = {
  match: RegExp;
  product: IdentifiedProduct;
};

const KNOWN: KnownProduct[] = [
  {
    match: /\b(qo\s*120|20a (single[- ]pole )?breaker|square d.*(20a|qo)|qo breaker)\b/i,
    product: {
      name: "Square D QO120 20A Single Pole Breaker",
      brand: "Square D",
      manufacturer: "Square D",
      barcode: "785901001201",
      mpn: "QO120",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(12\s*\/\s*2|12-2).*(nm-?b|romex)|romex|nm-?b\b/i,
    product: {
      name: "Southwire 12/2 NM-B Romex",
      brand: "Southwire",
      manufacturer: "Southwire",
      barcode: "032886902245",
      mpn: "288290",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(#?\s*12|number 12).*(thhn)|thhn\b/i,
    product: {
      name: "Southwire #12 THHN Black",
      brand: "Southwire",
      manufacturer: "Southwire",
      barcode: "045678912345",
      mpn: "THHN-12-BLK",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(3\s*\/\s*4|3-4).*(emt|conduit)|emt\b/i,
    product: {
      name: '3/4" EMT Conduit',
      brand: "Allied",
      manufacturer: "Allied",
      barcode: "034EMT075",
      mpn: "EMT-075-10",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(1\s*\/\s*2|1-2).*(pvc|conduit)|pvc conduit\b/i,
    product: {
      name: '1/2" PVC Conduit',
      brand: "Cantex",
      manufacturer: "Cantex",
      barcode: "012345678918",
      mpn: "PVC-050-40",
      source: "photo-catalog",
    },
  },
  {
    match: /\b4"?\s*square box|square box|raco\b/i,
    product: {
      name: '4" Square Box',
      brand: "Raco",
      manufacturer: "Raco",
      barcode: "078912345685",
      mpn: "RACO-190",
      source: "photo-catalog",
    },
  },
];

export function matchKnownProduct(hint: string): IdentifiedProduct | null {
  const text = hint.replace(/\s+/g, " ").trim();
  if (text.length < 3) return null;
  for (const row of KNOWN) {
    if (row.match.test(text)) return { ...row.product };
  }
  return null;
}
