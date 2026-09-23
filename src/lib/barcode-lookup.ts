import { barcodeVariants, digitsOnly, isGtin } from "./barcode";
import type { IdentifiedProduct } from "./types";

export type { IdentifiedProduct };

const cache = new Map<string, { at: number; value: IdentifiedProduct | null }>();
const CACHE_MS = 24 * 60 * 60 * 1000;
const LOOKUP_MS = 4000;

function remember(code: string, value: IdentifiedProduct | null) {
  cache.set(code, { at: Date.now(), value });
  return value;
}

function cached(code: string) {
  const hit = cache.get(code);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(code);
    return undefined;
  }
  return hit.value;
}

export function unknownProduct(code: string): IdentifiedProduct {
  const digits = digitsOnly(code);
  return {
    name: `Scanned item ${code.trim()}`,
    barcode: code.trim(),
    upc: digits || code.trim(),
    source: "scan",
    description: "No public product record yet. Add it to the catalog to receive, use, or transfer it.",
  };
}

async function readJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Stockr/0.2 (+https://stockr.currentflowconsulting.org)",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
    const text = await response.text();
    try {
      return { ok: response.ok, status: response.status, json: JSON.parse(text) as unknown };
    } catch {
      return { ok: false, status: response.status, json: null };
    }
  } catch {
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function fromOpenFacts(payload: unknown, source: string): IdentifiedProduct | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (Number(record.status) !== 1 || !record.product || typeof record.product !== "object") return null;
  const product = record.product as Record<string, unknown>;
  const name = firstString(product.product_name, product.product_name_en, product.generic_name);
  if (!name) return null;
  const code = firstString(record.code, product.code, product._id);
  const image =
    firstString(product.image_url, product.image_front_url, product.image_front_small_url) || undefined;
  const brand = firstString(product.brands, product.brand) || undefined;
  const category = firstString(
    typeof product.categories === "string" ? product.categories.split(",")[0] : "",
    Array.isArray(product.categories_tags) ? String(product.categories_tags[0] || "").replace(/^en:/, "") : "",
  );
  return {
    name,
    brand,
    manufacturer: brand,
    category: category || undefined,
    description: firstString(product.generic_name, product.ingredients_text) || undefined,
    image_url: image,
    barcode: code,
    upc: code.replace(/^0/, ""),
    source,
  };
}

function fromUpcItemDb(payload: unknown): IdentifiedProduct | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const items = Array.isArray(record.items) ? record.items : [];
  const item = items[0] as Record<string, unknown> | undefined;
  if (!item) return null;
  const name = firstString(item.title, item.description);
  if (!name) return null;
  const images = Array.isArray(item.images) ? item.images : [];
  const upc = firstString(item.upc, item.ean);
  return {
    name,
    brand: firstString(item.brand) || undefined,
    manufacturer: firstString(item.brand, item.publisher) || undefined,
    category: firstString(item.category) || undefined,
    description: firstString(item.description) || undefined,
    image_url: firstString(images[0]) || undefined,
    barcode: upc,
    upc,
    mpn: firstString(item.model, item.asin) || undefined,
    source: "upcitemdb",
  };
}

async function lookupOpenFacts(code: string, host: string, source: string) {
  const { json } = await readJson(`https://${host}/api/v2/product/${encodeURIComponent(code)}.json`);
  return fromOpenFacts(json, source);
}

async function lookupUpcItemDb(code: string) {
  const key = process.env.UPCITEMDB_API_KEY?.trim();
  const base = key ? "https://api.upcitemdb.com/prod/v1/lookup" : "https://api.upcitemdb.com/prod/trial/lookup";
  const { json } = await readJson(`${base}?upc=${encodeURIComponent(code)}`, {
    headers: key ? { user_key: key, key_type: "3scale" } : {},
  });
  return fromUpcItemDb(json);
}

async function searchOpenFacts(query: string, host: string, source: string) {
  const { json } = await readJson(
    `https://${host}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`,
  );
  if (!json || typeof json !== "object") return null;
  const products = (json as { products?: unknown[] }).products;
  const product = Array.isArray(products) ? products[0] : null;
  if (!product || typeof product !== "object") return null;
  const record = product as Record<string, unknown>;
  return fromOpenFacts({ status: 1, code: record.code, product: record }, source);
}

async function searchUpcItemDb(query: string) {
  const key = process.env.UPCITEMDB_API_KEY?.trim();
  const base = key ? "https://api.upcitemdb.com/prod/v1/search" : "https://api.upcitemdb.com/prod/trial/search";
  const { json } = await readJson(`${base}?s=${encodeURIComponent(query)}`, {
    headers: key ? { user_key: key, key_type: "3scale" } : {},
  });
  return fromUpcItemDb(json);
}

export async function searchRemoteProduct(query: string): Promise<IdentifiedProduct | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  const hit = cached(`q:${trimmed.toLowerCase()}`);
  if (hit !== undefined) return hit;
  const results = await Promise.all([
    searchOpenFacts(trimmed, "world.openproductsfacts.org", "open-products-facts"),
    searchOpenFacts(trimmed, "world.openfoodfacts.org", "open-food-facts"),
    searchUpcItemDb(trimmed),
  ]);
  const found = results.find(Boolean) || null;
  remember(`q:${trimmed.toLowerCase()}`, found);
  return found;
}

async function lookupGoUpc(code: string) {
  const key = process.env.GO_UPC_API_KEY?.trim();
  if (!key) return null;
  const { json } = await readJson(`https://go-upc.com/api/v1/code/${encodeURIComponent(code)}?key=${encodeURIComponent(key)}`);
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  const product = record.product && typeof record.product === "object" ? (record.product as Record<string, unknown>) : record;
  const name = firstString(product.name, product.title);
  if (!name) return null;
  return {
    name,
    brand: firstString(product.brand) || undefined,
    manufacturer: firstString(product.brand, product.manufacturer) || undefined,
    category: firstString(product.category, product.categoryPath) || undefined,
    description: firstString(product.description) || undefined,
    image_url: firstString(product.imageUrl, product.image) || undefined,
    barcode: firstString(product.ean, product.upc, code),
    upc: firstString(product.upc, product.ean, code),
    mpn: firstString(product.mpn) || undefined,
    source: "go-upc",
  } satisfies IdentifiedProduct;
}

export async function identifyRemoteProduct(code: string): Promise<IdentifiedProduct | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const hit = cached(trimmed);
  if (hit !== undefined) return hit || unknownProduct(trimmed);

  const variants = barcodeVariants(trimmed);
  const gtin = variants.find((value) => isGtin(value)) || variants.find((value) => digitsOnly(value).length >= 8) || trimmed;
  const lookups = [
    lookupOpenFacts(gtin, "world.openproductsfacts.org", "open-products-facts"),
    lookupOpenFacts(gtin, "world.openfoodfacts.org", "open-food-facts"),
    lookupOpenFacts(gtin, "world.openbeautyfacts.org", "open-beauty-facts"),
    lookupGoUpc(gtin),
    lookupUpcItemDb(gtin),
  ];
  const results = await Promise.all(lookups);
  const found = results.find(Boolean) || null;
  remember(trimmed, found);
  return found || unknownProduct(trimmed);
}
