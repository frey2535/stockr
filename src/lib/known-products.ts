import { barcodeVariants, digitsOnly } from "./barcode.ts";
import type { IdentifiedProduct } from "./types.ts";

type KnownProduct = {
  match: RegExp;
  product: IdentifiedProduct;
};

const KNOWN: KnownProduct[] = [
  {
    match: /\b(qo\s*120|square d.{0,40}(qo\s*120|20a (single[- ]pole )?breaker)|20a single[- ]pole breaker)\b/i,
    product: {
      name: "Square D QO120 20A Single Pole Breaker",
      brand: "Square D",
      manufacturer: "Square D",
      barcode: "785901001201",
      upc: "078912345678",
      mpn: "QO120",
      source: "photo-catalog",
    },
  },
  {
    match: /\b((12\s*\/\s*2|12-2).{0,24}(nm-?b|romex)|nm-?b romex)\b/i,
    product: {
      name: "Southwire 12/2 NM-B Romex",
      brand: "Southwire",
      manufacturer: "Southwire",
      barcode: "032886902245",
      upc: "045678912352",
      mpn: "NMB-122-250",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(#?\s*12|number 12).{0,16}thhn\b/i,
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
    match: /\b(3\s*\/\s*4|3-4).{0,16}(emt|conduit)\b/i,
    product: {
      name: '3/4" EMT Conduit',
      brand: "Allied",
      manufacturer: "Allied Tube",
      barcode: "012345678901",
      upc: "012345678901",
      mpn: "EMT-075-10",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(1\s*\/\s*2|1-2).{0,16}pvc\b/i,
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
    match: /\b(4"?\s*square box|raco[- ]?190)\b/i,
    product: {
      name: '4" Square Box',
      brand: "Raco",
      manufacturer: "Raco",
      barcode: "078912345685",
      mpn: "RACO-190",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(leviton.{0,24}(duplex|receptacle|t5320)|20a duplex receptacle|t5320[- ]?i)\b/i,
    product: {
      name: "Duplex Receptacle 20A",
      brand: "Leviton",
      manufacturer: "Leviton",
      barcode: "081234567890",
      mpn: "T5320-I",
      source: "photo-catalog",
    },
  },
  {
    match: /\b(lithonia.{0,24}troffer|led 2\s*[x×]\s*4 troffer|gtl[- ]?2x4)\b/i,
    product: {
      name: "LED 2x4 Troffer",
      brand: "Lithonia",
      manufacturer: "Lithonia",
      barcode: "081234567907",
      mpn: "GTL-2X4-40",
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

export function matchKnownByCode(code: string): IdentifiedProduct | null {
  const raw = String(code || "").trim();
  if (!raw) return null;
  const variants = new Set(
    [raw, digitsOnly(raw), ...barcodeVariants(raw)]
      .map((value) => value.trim())
      .filter(Boolean),
  );
  for (const row of KNOWN) {
    const codes = [row.product.barcode, row.product.upc, row.product.mpn].filter(Boolean) as string[];
    if (codes.some((value) => variants.has(value) || variants.has(digitsOnly(value)))) {
      return { ...row.product };
    }
  }
  return matchKnownProduct(raw);
}
