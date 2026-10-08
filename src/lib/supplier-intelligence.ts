import { getSupabaseAdmin } from "./supabase-admin";
import { uid } from "./id";
import { exactIdentityMatch, verifiedPriceHasEvidence } from "./supplier-price-policy";
import type {
  IdentifiedProduct,
  ProductSourceResult,
  SupplierOffer,
  SupplierProfile,
  SupplierSourceMatch,
  SourcingRule,
} from "./types";

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchEvidence(product: IdentifiedProduct, offer: SupplierOffer): SupplierSourceMatch["evidence"] {
  const mpn = Boolean(normalize(product.mpn) && normalize(product.mpn) === normalize(offer.mpn));
  const upc = Boolean(normalize(product.upc || product.barcode) && normalize(product.upc || product.barcode) === normalize(offer.upc));
  if (mpn && upc) return "mpn_and_upc";
  if (mpn) return "mpn";
  if (upc) return "upc";
  return "none";
}

function asSupplier(row: Record<string, unknown>): SupplierProfile {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    name: String(row.name || ""),
    website_url: String(row.website_url || ""),
    domain: String(row.domain || ""),
    priority: Number(row.priority || 100),
    enabled: row.enabled !== false,
    approved: row.approved !== false,
    branch_name: row.branch_name ? String(row.branch_name) : null,
    account_reference: row.account_reference ? String(row.account_reference) : null,
    allow_substitutes: row.allow_substitutes !== false,
    web_search_enabled: row.web_search_enabled !== false,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

function asOffer(row: Record<string, unknown>): SupplierOffer {
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    supplier_id: String(row.supplier_id),
    material_id: row.material_id ? String(row.material_id) : null,
    product_name: String(row.product_name || ""),
    manufacturer: row.manufacturer ? String(row.manufacturer) : null,
    mpn: row.mpn ? String(row.mpn) : null,
    upc: row.upc ? String(row.upc) : null,
    supplier_sku: row.supplier_sku ? String(row.supplier_sku) : null,
    price: row.price == null ? null : Number(row.price),
    currency: String(row.currency || "USD"),
    unit: row.unit ? String(row.unit) : null,
    product_url: row.product_url ? String(row.product_url) : null,
    source_type: row.source_type as SupplierOffer["source_type"],
    source_reference: row.source_reference ? String(row.source_reference) : null,
    observed_at: String(row.observed_at || new Date().toISOString()),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    exact_match: row.exact_match === true,
  };
}

export async function listSuppliers(companyId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_suppliers")
    .select("*")
    .eq("company_id", companyId)
    .order("priority")
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []).map((row) => asSupplier(row as Record<string, unknown>));
}

export async function saveSupplier(companyId: string, input: Partial<SupplierProfile> & { name: string }) {
  let domain = String(input.domain || "").trim().toLowerCase();
  const website = String(input.website_url || "").trim();
  if (!domain && website) {
    try {
      domain = new URL(website).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      domain = "";
    }
  }
  const row = {
    id: input.id || uid("sup"),
    company_id: companyId,
    name: input.name.trim(),
    website_url: website,
    domain,
    priority: Number(input.priority || 100),
    enabled: input.enabled !== false,
    approved: input.approved !== false,
    branch_name: input.branch_name?.trim() || null,
    account_reference: input.account_reference?.trim() || null,
    allow_substitutes: input.allow_substitutes !== false,
    web_search_enabled: input.web_search_enabled !== false,
  };
  if (!row.name) throw new Error("Supplier name is required.");
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_suppliers")
    .upsert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return asSupplier(data as Record<string, unknown>);
}

export async function listSourcingRules(companyId: string): Promise<SourcingRule[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_sourcing_rules")
    .select("*")
    .eq("company_id", companyId)
    .order("category");
  if (error) throw new Error(error.message);
  return (data || []).map((row) => ({
    id: String(row.id),
    company_id: String(row.company_id),
    category: String(row.category || ""),
    preferred_supplier_id: row.preferred_supplier_id ? String(row.preferred_supplier_id) : null,
    preferred_manufacturer: row.preferred_manufacturer ? String(row.preferred_manufacturer) : null,
    allow_substitutes: row.allow_substitutes !== false,
    created_at: String(row.created_at || new Date().toISOString()),
  }));
}

export async function saveSourcingRule(companyId: string, input: Partial<SourcingRule> & { category: string }) {
  const row = {
    id: input.id || uid("rule"),
    company_id: companyId,
    category: input.category.trim(),
    preferred_supplier_id: input.preferred_supplier_id || null,
    preferred_manufacturer: input.preferred_manufacturer?.trim() || null,
    allow_substitutes: input.allow_substitutes !== false,
  };
  if (!row.category) throw new Error("Category is required.");
  const { data, error } = await getSupabaseAdmin().from("stockr_sourcing_rules").upsert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as SourcingRule;
}

export async function deleteSourcingRule(companyId: string, id: string) {
  const { error } = await getSupabaseAdmin().from("stockr_sourcing_rules").delete().eq("company_id", companyId).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSupplier(companyId: string, id: string) {
  const { error } = await getSupabaseAdmin()
    .from("stockr_suppliers")
    .delete()
    .eq("company_id", companyId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recordVerifiedOffer(
  companyId: string,
  input: Omit<SupplierOffer, "id" | "company_id" | "observed_at"> & { observed_at?: string },
) {
  if (input.price != null && (!Number.isFinite(input.price) || input.price < 0)) {
    throw new Error("Verified supplier price must be a non-negative number.");
  }
  if (!verifiedPriceHasEvidence(input)) {
    throw new Error("A verified price requires a source reference or supplier product URL.");
  }
  const row = {
    ...input,
    id: uid("off"),
    company_id: companyId,
    observed_at: input.observed_at || new Date().toISOString(),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("stockr_supplier_offers")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return asOffer(data as Record<string, unknown>);
}

async function storedOffers(companyId: string, product: IdentifiedProduct) {
  // Query by product identity instead of taking the company's 200 newest
  // offers: unrelated recently imported catalog rows must not hide a match.
  const identifiers = [
    ["mpn", product.mpn],
    ["upc", product.upc || product.barcode],
  ] as const;
  const lookups = identifiers
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([column, value]) =>
      getSupabaseAdmin()
        .from("stockr_supplier_offers")
        .select("*")
        .eq("company_id", companyId)
        .eq(column, value!.trim())
        .order("observed_at", { ascending: false })
        .limit(200),
    );
  if (!lookups.length) return [];
  const results = await Promise.all(lookups);
  const unique = new Map<string, SupplierOffer>();
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const offer = asOffer(row as Record<string, unknown>);
      unique.set(offer.id, offer);
    }
  }
  const now = Date.now();
  return [...unique.values()]
    .filter((offer) => !offer.expires_at || new Date(offer.expires_at).getTime() >= now)
    .filter((offer) => exactIdentityMatch(product, offer));
}

async function purchaseHistoryOffers(companyId: string, product: IdentifiedProduct, suppliers: SupplierProfile[]) {
  const db = getSupabaseAdmin();
  const ids = [product.mpn, product.upc, product.barcode].map(normalize).filter(Boolean);
  if (!ids.length) return [] as SupplierOffer[];

  const { data: materials, error: materialError } = await db
    .from("stockr_materials")
    .select("id, name, manufacturer, mpn, upc, barcode, unit")
    .eq("company_id", companyId);
  if (materialError) throw new Error(materialError.message);
  const matching = (materials || []).filter((row) => {
    const rowIds = [row.mpn, row.upc, row.barcode].map((value) => normalize(String(value || "")));
    return rowIds.some((value) => value && ids.includes(value));
  });
  if (!matching.length) return [];

  const materialIds = matching.map((row) => String(row.id));
  const { data: lines, error: lineError } = await db
    .from("stockr_purchase_order_lines")
    .select("purchase_order_id, material_id, unit_cost")
    .eq("company_id", companyId)
    .in("material_id", materialIds)
    .not("unit_cost", "is", null);
  if (lineError) throw new Error(lineError.message);
  if (!lines?.length) return [];

  const poIds = Array.from(new Set(lines.map((row) => String(row.purchase_order_id))));
  const { data: pos, error: poError } = await db
    .from("stockr_purchase_orders")
    .select("id, supplier, created_at")
    .eq("company_id", companyId)
    .in("id", poIds);
  if (poError) throw new Error(poError.message);
  const poById = new Map((pos || []).map((row) => [String(row.id), row]));

  return lines.flatMap((line) => {
    const po = poById.get(String(line.purchase_order_id));
    const material = matching.find((row) => String(row.id) === String(line.material_id));
    if (!po || !material || line.unit_cost == null) return [];
    const supplier = suppliers.find((row) => row.name.trim().toLowerCase() === String(po.supplier || "").trim().toLowerCase());
    if (!supplier) return [];
    return [{
      id: `history_${line.purchase_order_id}_${line.material_id}`,
      company_id: companyId,
      supplier_id: supplier.id,
      material_id: String(material.id),
      product_name: String(material.name || product.name),
      manufacturer: String(material.manufacturer || product.manufacturer || "") || null,
      mpn: String(material.mpn || product.mpn || "") || null,
      upc: String(material.upc || product.upc || product.barcode || "") || null,
      supplier_sku: null,
      price: Number(line.unit_cost),
      currency: "USD",
      unit: String(material.unit || "") || null,
      product_url: null,
      source_type: "purchase_history" as const,
      source_reference: `PO ${po.id}`,
      observed_at: String(po.created_at || new Date().toISOString()),
      expires_at: null,
      exact_match: true,
    }];
  });
}

type CseItem = { link?: string; title?: string; snippet?: string };

async function googleSiteSearch(domain: string, product: IdentifiedProduct) {
  const key = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_CX?.trim();
  if (!key || !cx || !domain) return [] as CseItem[];
  const identity = product.mpn || product.upc || product.barcode || product.name;
  const q = `site:${domain} "${identity}"`;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", key);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q);
  url.searchParams.set("num", "5");
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json() as { items?: CseItem[] };
    return payload.items || [];
  } catch {
    return [];
  }
}

function sameDomain(url: string, domain: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const wanted = domain.replace(/^www\./, "").toLowerCase();
    return host === wanted || host.endsWith(`.${wanted}`);
  } catch {
    return false;
  }
}

function jsonLdObjects(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(jsonLdObjects);
  if (typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const graph = Array.isArray(row["@graph"]) ? row["@graph"].flatMap(jsonLdObjects) : [];
  return [row, ...graph];
}

function schemaTypeIncludes(row: Record<string, unknown>, expected: string) {
  const value = row["@type"];
  const values = Array.isArray(value) ? value : [value];
  return values.some((item) => String(item || "").toLowerCase() === expected.toLowerCase());
}

function offerPrice(offers: unknown) {
  const rows = jsonLdObjects(offers);
  for (const row of rows) {
    const raw = row.price ?? row.lowPrice;
    const price = raw == null ? null : Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (price != null && Number.isFinite(price) && price > 0) {
      return {
        price,
        currency: String(row.priceCurrency || "USD"),
      };
    }
  }
  return null;
}

async function extractSupplierPage(supplier: SupplierProfile, url: string, product: IdentifiedProduct) {
  if (!sameDomain(url, supplier.domain)) return null;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": "Stockr/1.0 (+https://stockr.currentflowconsulting.org)" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of scripts) {
      let parsed: unknown;
      try { parsed = JSON.parse(match[1]); } catch { continue; }
      for (const row of jsonLdObjects(parsed)) {
        if (!schemaTypeIncludes(row, "Product")) continue;
        const mpn = String(row.mpn || row.sku || "");
        const gtin = String(row.gtin13 || row.gtin12 || row.gtin14 || row.gtin || "");
        const candidate: SupplierOffer = {
          id: uid("off"),
          company_id: supplier.company_id,
          supplier_id: supplier.id,
          material_id: null,
          product_name: String(row.name || product.name),
          manufacturer: typeof row.brand === "object" && row.brand ? String((row.brand as Record<string, unknown>).name || "") : String(row.brand || product.manufacturer || ""),
          mpn: mpn || null,
          upc: gtin || null,
          supplier_sku: String(row.sku || "") || null,
          price: null,
          currency: "USD",
          unit: null,
          product_url: url,
          source_type: "supplier_page",
          source_reference: url,
          observed_at: new Date().toISOString(),
          expires_at: null,
          exact_match: false,
        };
        candidate.exact_match = exactIdentityMatch(product, candidate);
        if (!candidate.exact_match) continue;
        const price = offerPrice(row.offers);
        if (price) {
          candidate.price = price.price;
          candidate.currency = price.currency;
        }
        return candidate;
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function discoverSupplierOffer(supplier: SupplierProfile, product: IdentifiedProduct) {
  if (!supplier.enabled || !supplier.approved || !supplier.web_search_enabled || !supplier.domain) return null;
  const results = await googleSiteSearch(supplier.domain, product);
  for (const result of results) {
    if (!result.link) continue;
    const offer = await extractSupplierPage(supplier, result.link, product);
    if (!offer) continue;
    if (offer.price != null) {
      try {
        const { data, error } = await getSupabaseAdmin()
          .from("stockr_supplier_offers")
          .insert(offer)
          .select("*")
          .single();
        if (!error && data) return asOffer(data as Record<string, unknown>);
      } catch {
        // Return the verified supplier-page offer even if caching failed.
      }
    }
    return offer;
  }
  return null;
}

export async function sourceProduct(
  companyId: string,
  product: IdentifiedProduct,
  options?: { supplierWebSearch?: boolean; broadWebSearch?: boolean },
): Promise<ProductSourceResult> {
  const rules = await listSourcingRules(companyId);
  const rule = rules.find((row) => row.category.trim().toLowerCase() === String(product.category || "").trim().toLowerCase());
  const suppliers = (await listSuppliers(companyId))
    .filter((row) => row.enabled && row.approved)
    .sort((a, b) => {
      if (rule?.preferred_supplier_id === a.id && rule?.preferred_supplier_id !== b.id) return -1;
      if (rule?.preferred_supplier_id === b.id && rule?.preferred_supplier_id !== a.id) return 1;
      return a.priority - b.priority || a.name.localeCompare(b.name);
    });
  const stored = await storedOffers(companyId, product);
  const history = await purchaseHistoryOffers(companyId, product, suppliers);

  const preferred: SupplierSourceMatch[] = [];
  for (const supplier of suppliers) {
    const preferredManufacturer = normalize(rule?.preferred_manufacturer);
    const candidates = [...stored, ...history]
      .filter((offer) => offer.supplier_id === supplier.id && exactIdentityMatch(product, offer))
      .sort((a, b) => {
        if (preferredManufacturer) {
          const aPreferred = normalize(a.manufacturer) === preferredManufacturer;
          const bPreferred = normalize(b.manufacturer) === preferredManufacturer;
          if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
        }
        return new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime();
      });
    let offer: SupplierOffer | null = candidates[0] ?? null;
    if (!offer && options?.supplierWebSearch !== false) {
      offer = await discoverSupplierOffer(supplier, product);
    }
    preferred.push({
      supplier,
      offer,
      product: offer
        ? {
            name: offer.product_name,
            manufacturer: offer.manufacturer || undefined,
            brand: offer.manufacturer || undefined,
            barcode: offer.upc || product.barcode || "",
            upc: offer.upc || undefined,
            mpn: offer.mpn || undefined,
            source: offer.source_type,
          }
        : null,
      exactMatch: Boolean(offer?.exact_match),
      priceStatus: offer?.price != null ? "verified" : "unavailable",
      note: offer?.price != null
        ? undefined
        : "No verified supplier price was found. Stockr will not estimate or invent a price.",
      evidence: offer ? matchEvidence(product, offer) : "none",
    });
  }

  return {
    preferred,
    purchaseHistory: history,
    broaderWebUsed: Boolean(options?.broadWebSearch),
    searchOrder: [
      "company_catalog_and_purchase_history",
      "selected_suppliers",
      "manufacturer_and_public_product_sources",
      ...(options?.broadWebSearch ? ["broader_web"] : []),
    ],
  };
}
