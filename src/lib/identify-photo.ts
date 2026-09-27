import type { IdentifiedProduct } from "./types.ts";

function codesOverlap(left: string, right: string) {
  const rawLeft = left.trim();
  const rawRight = right.trim();
  if (rawLeft && rawLeft === rawRight) return true;
  const digitsLeft = rawLeft.replace(/\D/g, "");
  const digitsRight = rawRight.replace(/\D/g, "");
  if (!digitsLeft || !digitsRight) return false;
  return digitsLeft === digitsRight || digitsLeft.endsWith(digitsRight) || digitsRight.endsWith(digitsLeft);
}

export type IdentityField = "name" | "barcode" | "mpn";

export type PhotoIdentityResult = {
  identified: IdentifiedProduct | null;
  draft: { name: string; barcode: string; mpn: string; brand?: string; manufacturer?: string; description?: string; image_url?: string; source: string };
  missing: IdentityField[];
};

function filled(value?: string | null) {
  return Boolean(value?.trim());
}

export function isWeakIdentity(product: IdentifiedProduct | null | undefined) {
  if (!product?.name?.trim()) return true;
  return (
    product.source === "scan" ||
    product.source === "photo" ||
    /^scanned item\b/i.test(product.name) ||
    /^photo item\b/i.test(product.name) ||
    /^item from (camera )?photo/i.test(product.name) ||
    /^unknown product\b/i.test(product.name)
  );
}

export function identityGaps(product: Partial<IdentifiedProduct> | null | undefined): IdentityField[] {
  const missing: IdentityField[] = [];
  if (!filled(product?.name) || isWeakIdentity(product as IdentifiedProduct)) missing.push("name");
  if (!filled(product?.barcode)) missing.push("barcode");
  if (!filled(product?.mpn)) missing.push("mpn");
  return missing;
}

export function inferCatalogNumber(product: Partial<IdentifiedProduct> | null | undefined) {
  if (filled(product?.mpn)) return String(product?.mpn).trim();
  const source = [product?.name, product?.description, ...(product?.search_queries || [])].filter(Boolean).join(" ");
  const sku = source.match(/\b([A-Za-z]{1,8}[-/]?[A-Za-z]?\d{2,}[A-Za-z0-9-]*)\b/);
  if (sku?.[1]) return sku[1];
  const catalog = source.match(/\b(\d{5,8})\b/);
  return catalog?.[1] || "";
}

export function isCompleteIdentity(product: IdentifiedProduct | null | undefined): product is IdentifiedProduct {
  return identityGaps(product).length === 0;
}

export function buildProductSearchQuery(product: Partial<IdentifiedProduct>) {
  return [product.brand, product.manufacturer, product.name, product.mpn, product.barcode]
    .filter((value, index, all) => Boolean(value) && all.indexOf(value) === index)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function visionSearchQueries(vision: IdentifiedProduct | null, extra: string[] = []) {
  const queries = [
    ...extra,
    ...(vision?.search_queries || []),
    vision?.mpn || "",
    vision?.barcode || "",
    vision && !isWeakIdentity(vision) ? buildProductSearchQuery(vision) : "",
    vision && !isWeakIdentity(vision) ? [vision.brand || vision.manufacturer, vision.mpn || vision.name].filter(Boolean).join(" ") : "",
    vision && !isWeakIdentity(vision) ? `${buildProductSearchQuery(vision)} UPC` : "",
    vision && !isWeakIdentity(vision) ? `${buildProductSearchQuery(vision)} barcode` : "",
  ];
  return Array.from(new Set(queries.map((value) => value.replace(/\s+/g, " ").trim()).filter((value) => value.length >= 3)));
}

function firstFilled(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (filled(value)) return String(value).trim();
  }
  return "";
}

export function mergeIdentities(...parts: Array<IdentifiedProduct | null | undefined>): IdentifiedProduct {
  const list = parts.filter((row): row is IdentifiedProduct => Boolean(row));
  const named = list.filter((row) => !isWeakIdentity(row));
  const source = named.find(isCompleteIdentity)?.source || named[0]?.source || list[0]?.source || "photo";
  return {
    name: firstFilled(...named.map((row) => row.name), ...list.map((row) => row.name)),
    brand: firstFilled(...list.map((row) => row.brand)) || undefined,
    manufacturer: firstFilled(...list.map((row) => row.manufacturer), ...list.map((row) => row.brand)) || undefined,
    category: firstFilled(...list.map((row) => row.category)) || undefined,
    description: firstFilled(...named.map((row) => row.description), ...list.map((row) => row.description)) || undefined,
    image_url: firstFilled(...list.map((row) => row.image_url)) || undefined,
    barcode: firstFilled(...list.map((row) => row.barcode)),
    upc: firstFilled(...list.map((row) => row.upc), ...list.map((row) => row.barcode)) || undefined,
    mpn: firstFilled(...list.map((row) => row.mpn)) || undefined,
    source,
  };
}

function toDraft(product: IdentifiedProduct): PhotoIdentityResult["draft"] {
  return {
    name: isWeakIdentity(product) ? "" : product.name,
    barcode: product.barcode || "",
    mpn: product.mpn || "",
    brand: product.brand,
    manufacturer: product.manufacturer,
    description: product.description,
    image_url: product.image_url,
    source: product.source,
  };
}

function asBox(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const box = value as Record<string, unknown>;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.w ?? box.width);
  const h = Number(box.h ?? box.height);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return undefined;
  return { x, y, w, h };
}

export function parseVisionObjects(payload: unknown): IdentifiedProduct[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const rows = Array.isArray(record.objects)
    ? record.objects
    : Array.isArray(record.items)
      ? record.items
      : record.name
        ? [record]
        : [];
  const seen = new Set<string>();
  const objects: IdentifiedProduct[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const name = String(item.name || item.title || "").trim();
    if (!name) continue;
    const key = [name, item.mpn, item.barcode].join("|").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    objects.push({
      name,
      brand: String(item.brand || "").trim() || undefined,
      manufacturer: String(item.manufacturer || item.brand || "").trim() || undefined,
      category: String(item.category || "").trim() || undefined,
      description: String(item.description || "").trim() || undefined,
      barcode: String(item.barcode || item.upc || item.ean || "").trim(),
      upc: String(item.upc || item.barcode || "").trim() || undefined,
      mpn: String(item.mpn || item.sku || item.catalog_number || item.part_number || "").trim() || undefined,
      source: "photo-vision",
      search_queries: Array.isArray(item.search_queries)
        ? item.search_queries.map((query) => String(query || "").trim()).filter(Boolean).slice(0, 6)
        : undefined,
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
      box: asBox(item.box),
    });
    if (objects.length >= 12) break;
  }
  return objects;
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "inch", "in", "of", "a", "an", "to", "by"]);

function normalizeSku(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function significantTokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function listingAgrees(known: Partial<IdentifiedProduct> | null | undefined, listing: IdentifiedProduct) {
  if (isWeakIdentity(listing)) return false;
  const name = known?.name?.trim() || "";
  const mpn = known?.mpn?.trim() || "";
  const barcode = known?.barcode?.trim() || "";
  const brand = (known?.brand || known?.manufacturer || "").trim();
  if (!name && !mpn && !barcode) return true;
  if (barcode && listing.barcode && codesOverlap(barcode, listing.barcode)) {
    return true;
  }
  if (mpn && listing.mpn && normalizeSku(mpn) === normalizeSku(listing.mpn)) return true;
  const haystack = [listing.name, listing.mpn, listing.brand, listing.manufacturer, ...(listing.search_queries || [])]
    .filter(Boolean)
    .join(" ");
  const needles = [mpn, name, ...(known?.search_queries || [])].filter(Boolean);
  if (needles.some((needle) => normalizeSku(needle) && normalizeSku(haystack).includes(normalizeSku(needle)))) return true;
  if (listing.mpn && name && normalizeSku(name).includes(normalizeSku(listing.mpn))) return true;
  const knownTokens = significantTokens([brand, name, mpn, ...(known?.search_queries || [])].filter(Boolean).join(" "));
  const listingTokens = significantTokens([listing.brand, listing.manufacturer, listing.name, listing.mpn].filter(Boolean).join(" "));
  const overlap = knownTokens.filter((token) => listingTokens.includes(token));
  if (overlap.some((token) => /\d/.test(token) && token.length >= 3)) return true;
  if (
    knownTokens.some((knownToken) =>
      listingTokens.some((listingToken) => {
        if (knownToken === listingToken) return false;
        return (/\d/.test(knownToken) || /\d/.test(listingToken)) && (knownToken.includes(listingToken) || listingToken.includes(knownToken));
      }),
    )
  ) {
    return true;
  }
  if (brand && (listing.brand || listing.manufacturer) && normalizeSku(brand) === normalizeSku(listing.brand || listing.manufacturer || "") && overlap.length >= 1) {
    return true;
  }
  return overlap.length >= 2;
}

export async function resolvePhotoIdentities(
  visions: IdentifiedProduct[],
  barcodes: string[],
  identifyCode: (code: string) => Promise<IdentifiedProduct | null>,
  search: (query: string) => Promise<IdentifiedProduct | null>,
  completeIdentity?: (product: Partial<IdentifiedProduct>) => Promise<IdentifiedProduct | null>,
): Promise<PhotoIdentityResult[]> {
  const used = new Set<string>();
  const uniqueVisions = visions.slice(0, 12);
  const results = await Promise.all(
    uniqueVisions.map((vision) => {
      const code = (vision.barcode || "").trim();
      if (code) used.add(code);
      return resolvePhotoIdentity(code, vision, identifyCode, search, completeIdentity);
    }),
  );
  const leftovers = barcodes
    .map((code) => code.trim())
    .filter((code) => code && !used.has(code) && !results.some((row) => row.draft.barcode === code || row.identified?.barcode === code));
  for (const code of leftovers.slice(0, 8)) {
    results.push(await resolvePhotoIdentity(code, null, identifyCode, search, completeIdentity));
  }
  if (!results.length && barcodes[0]) {
    results.push(await resolvePhotoIdentity(barcodes[0], null, identifyCode, search, completeIdentity));
  }
  if (!results.length) {
    results.push(await resolvePhotoIdentity("", null, identifyCode, search, completeIdentity));
  }
  return results;
}

export async function resolvePhotoIdentity(
  barcode: string,
  vision: IdentifiedProduct | null,
  identifyCode: (code: string) => Promise<IdentifiedProduct | null>,
  search: (query: string) => Promise<IdentifiedProduct | null>,
  completeIdentity?: (product: Partial<IdentifiedProduct>) => Promise<IdentifiedProduct | null>,
): Promise<PhotoIdentityResult> {
  const code = (barcode || vision?.barcode || "").trim();
  const seed = mergeIdentities(
    vision && !isWeakIdentity(vision) ? { ...vision, barcode: vision.barcode || code, mpn: vision.mpn } : null,
    code ? { name: vision && !isWeakIdentity(vision) ? vision.name : "", barcode: code, source: "photo" } : null,
  );
  if (isCompleteIdentity(seed)) {
    return { identified: seed, draft: toDraft(seed), missing: [] };
  }

  const listings: IdentifiedProduct[] = [];
  const rememberListing = (row: IdentifiedProduct | null) => {
    if (row && listingAgrees(seed, row)) listings.push(row);
  };

  if (code) rememberListing(await identifyCode(code));

  const searched = await Promise.all(visionSearchQueries(vision, [code]).slice(0, 4).map((query) => search(query)));
  for (const row of searched) rememberListing(row);

  let merged = mergeIdentities(...listings, seed);
  if (merged.barcode && !merged.mpn) rememberListing(await identifyCode(merged.barcode));
  merged = mergeIdentities(...listings, seed);

  if (identityGaps(merged).length && completeIdentity) {
    const known = await completeIdentity(merged);
    if (known && listingAgrees(merged, { ...known, source: known.source || "photo-knowledge" })) {
      merged = mergeIdentities(merged, { ...known, source: known.source || "photo-knowledge" });
    } else if (known && !merged.name && !isWeakIdentity(known)) {
      merged = mergeIdentities(merged, known);
    }
  }

  if (merged.barcode && !merged.mpn) {
    const extra = await identifyCode(merged.barcode);
    if (extra && listingAgrees(merged, extra)) merged = mergeIdentities(merged, extra);
  }

  if (!merged.mpn) {
    const inferred = inferCatalogNumber(merged);
    if (inferred) merged = { ...merged, mpn: inferred };
  }

  const missing = identityGaps(merged);
  if (!missing.length) {
    return { identified: merged, draft: toDraft(merged), missing };
  }
  return { identified: null, draft: toDraft(merged), missing };
}
