import { DAY_ONE_CATALOG, type DayOneCatalogSeed } from "./dayone-catalog.ts";
import {
  chunkRows,
  claimableDayOneCompanyIds,
  dayOneMaterialId,
  dayOneMissingItems,
  dayOneScopedMaterialId,
  shouldBootstrapDayOneCatalog,
} from "./dayone-catalog-policy.ts";
import { isSupabaseConfigured } from "./db-config.ts";
import { upsertMaterialRows } from "./material-write.ts";
import { getSupabaseAdmin } from "./supabase-admin.ts";
import type { Material } from "./types.ts";

export type DayOneCompanyRow = {
  id: string;
  name: string;
  buildr_company_id?: string | null;
};

export type DayOneBootstrapReport = {
  companies: Array<{ id: string; name: string; materials: number; matched: boolean }>;
  reservedRows: number;
  seeded: Array<{ companyId: string; name: string; inserted: boolean }>;
};

function dayOneSeedMaterial(companyId: string, item: DayOneCatalogSeed, id: string): Material {
  return {
    id,
    name: item.name,
    description: [
      item.variant ? "Variant: " + item.variant : "",
      "Generic taxonomy entry - verify manufacturer SKU",
      "Verification: Unverified",
      item.sku,
    ]
      .filter(Boolean)
      .join(" | "),
    category: item.category,
    sub_category: item.subCategory,
    manufacturer: "",
    supplier: "",
    unit:
      item.unit === "EA"
        ? "each"
        : item.unit === "FT"
          ? "ft"
          : item.unit === "STICK"
            ? "stick"
            : item.unit.toLowerCase(),
    unit_cost: null,
    barcode: item.sku,
    mpn: "",
    upc: "",
    supplier_number: "",
    reorder_point: null,
    min_stock_level: null,
    image_url: "",
    aliases: [item.sku, item.variant].filter(Boolean),
  };
}

async function insertDayOneItems(
  companyId: string,
  items: DayOneCatalogSeed[],
  idFor: (item: DayOneCatalogSeed) => string,
) {
  for (const batch of chunkRows(items, 100)) {
    const saved = await upsertMaterialRows(
      companyId,
      batch.map((item) => dayOneSeedMaterial(companyId, item, idFor(item))),
    );
    if (!saved.ok) {
      console.error("Day One catalog insert", saved.error);
      return false;
    }
  }
  return true;
}

async function loadCompany(companyId: string): Promise<DayOneCompanyRow | null> {
  const db = getSupabaseAdmin();
  let companyRes = await db
    .from("stockr_companies")
    .select("id, name, buildr_company_id")
    .eq("id", companyId)
    .maybeSingle();
  if (companyRes.error && /buildr_company_id|schema cache|does not exist|could not find/i.test(companyRes.error.message)) {
    companyRes = await db.from("stockr_companies").select("id, name").eq("id", companyId).maybeSingle();
  }
  if (companyRes.error) {
    console.error("Day One catalog company lookup", companyRes.error.message);
    return null;
  }
  const company = companyRes.data;
  if (!company) return null;
  return {
    id: String(company.id),
    name: String(company.name || ""),
    buildr_company_id: String((company as { buildr_company_id?: string }).buildr_company_id || ""),
  };
}

export async function seedDayOneCatalogForCompany(companyId: string) {
  const company = await loadCompany(companyId);
  if (!company) return false;
  const buildrCompanyId = String(company.buildr_company_id || "").trim();
  if (!shouldBootstrapDayOneCatalog(companyId, buildrCompanyId, company.name)) return false;

  const db = getSupabaseAdmin();
  const { data, error } = await db.from("stockr_materials").select("id, company_id").like("id", "dayone_stk_e_%");
  if (error) {
    console.error("Day One catalog lookup", error.message);
    return false;
  }

  const existingRows = (data || []).map((row) => ({
    id: String(row.id),
    company_id: String(row.company_id),
  }));
  let missing;
  try {
    missing = dayOneMissingItems(existingRows, companyId);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    if (!/tenant isolation/i.test(message)) throw caught;
    const collisions = existingRows.filter((row) => row.company_id !== companyId);
    const { data: owners } = await db
      .from("stockr_companies")
      .select("id, name")
      .in("id", [...new Set(collisions.map((row) => row.company_id))]);
    const claimFrom = claimableDayOneCompanyIds(collisions, (owners || []) as Array<{ id: string; name?: string | null }>);
    if (claimFrom.length) {
      const { error: claimError } = await db
        .from("stockr_materials")
        .update({ company_id: companyId })
        .like("id", "dayone_stk_e_%")
        .in("company_id", claimFrom);
      if (!claimError) {
        const claimed = await db.from("stockr_materials").select("id, company_id").like("id", "dayone_stk_e_%");
        if (!claimed.error) {
          missing = dayOneMissingItems(
            (claimed.data || []).map((row) => ({ id: String(row.id), company_id: String(row.company_id) })),
            companyId,
          );
          if (!missing.length) return true;
          return insertDayOneItems(companyId, missing, dayOneMaterialId);
        }
      }
      if (claimError) console.error("Day One catalog claim", claimError.message);
    }
    const { data: scopedRows, error: scopedError } = await db
      .from("stockr_materials")
      .select("id")
      .eq("company_id", companyId)
      .like("id", "dayone_%");
    if (scopedError) {
      console.error("Day One catalog scoped lookup", scopedError.message);
      return false;
    }
    const existingScoped = new Set((scopedRows || []).map((row) => String(row.id)));
    const scopedMissing = DAY_ONE_CATALOG.filter(
      (item) => !existingScoped.has(dayOneScopedMaterialId(companyId, item)),
    );
    if (!scopedMissing.length) return true;
    return insertDayOneItems(companyId, scopedMissing, (item) => dayOneScopedMaterialId(companyId, item));
  }
  if (!missing.length) return true;
  return insertDayOneItems(companyId, missing, dayOneMaterialId);
}

const dayOneBootstrapPromises = new Map<string, Promise<void>>();

export async function ensureDayOneCatalog(companyId: string) {
  if (!isSupabaseConfigured()) return;
  const active = dayOneBootstrapPromises.get(companyId);
  if (active) return active;

  const bootstrap = (async () => {
    try {
      await seedDayOneCatalogForCompany(companyId);
    } catch (error) {
      console.error("Day One catalog bootstrap", error instanceof Error ? error.message : error);
    }
  })();

  dayOneBootstrapPromises.set(companyId, bootstrap);
  try {
    await bootstrap;
  } finally {
    if (dayOneBootstrapPromises.get(companyId) === bootstrap) {
      dayOneBootstrapPromises.delete(companyId);
    }
  }
}

export async function bootstrapDayOneCatalogs(): Promise<DayOneBootstrapReport> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  const db = getSupabaseAdmin();
  const companiesRes = await db.from("stockr_companies").select("id, name, buildr_company_id").order("name");
  if (companiesRes.error) throw new Error(companiesRes.error.message);
  const companies = (companiesRes.data || []) as DayOneCompanyRow[];

  const reserved = await db.from("stockr_materials").select("id, company_id").like("id", "dayone_stk_e_%");
  if (reserved.error) throw new Error(reserved.error.message);

  const report: DayOneBootstrapReport = {
    companies: [],
    reservedRows: (reserved.data || []).length,
    seeded: [],
  };

  for (const company of companies) {
    const countRes = await db
      .from("stockr_materials")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);
    const matched = shouldBootstrapDayOneCatalog(company.id, String(company.buildr_company_id || ""), company.name);
    report.companies.push({
      id: company.id,
      name: company.name,
      materials: Number(countRes.count || 0),
      matched,
    });
    if (!matched) continue;
    const inserted = await seedDayOneCatalogForCompany(company.id);
    report.seeded.push({ companyId: company.id, name: company.name, inserted });
    const after = await db
      .from("stockr_materials")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);
    const row = report.companies.find((item) => item.id === company.id);
    if (row) row.materials = Number(after.count || 0);
  }

  return report;
}
