import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { commandAccessError } from "@/lib/command-access";
import { parseMaterialCsv } from "@/lib/csv";
import { validateCatalogImportRows } from "@/lib/catalog-import";
import { getPlan } from "@/lib/plans";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { uid } from "@/lib/id";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_IMPORT_ROWS = 10_000;

function migrationMissing(error: { message?: string; code?: string } | null) {
  const message = error?.message || "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST202" ||
    error?.code === "PGRST205" ||
    /stockr_catalog_imports|stockr_import_catalog_batch|schema cache|does not exist/i.test(message)
  );
}

export async function GET() {
  const { account, response } = await requireAccount();
  if (!account) return response;

  const result = await getSupabaseAdmin()
    .from("stockr_catalog_imports")
    .select("id, file_name, supplier_id, status, row_count, created_count, updated_count, priced_count, error_message, created_by, created_at, completed_at")
    .eq("company_id", account.company.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (result.error) {
    if (migrationMissing(result.error)) {
      return NextResponse.json({ rows: [], migrationRequired: true });
    }
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ rows: result.data || [] });
}

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;

  const denied = commandAccessError(account.role, "upsertMaterials");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Could not read the catalog upload." }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a CSV catalog file." }, { status: 400 });
  }
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
    return NextResponse.json({ error: "Catalog imports currently require a CSV file." }, { status: 400 });
  }
  if (file.size <= 0) return NextResponse.json({ error: "The catalog file is empty." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Catalog file is too large. Split it into CSV files smaller than 8 MB." },
      { status: 413 },
    );
  }

  const supplierId = String(form.get("supplierId") || "").trim() || null;
  const text = await file.text();
  const rows = parseMaterialCsv(text);
  const validation = validateCatalogImportRows(rows, {
    supplierSelected: Boolean(supplierId),
    maxRows: MAX_IMPORT_ROWS,
  });

  for (const [index, row] of rows.entries()) {
    if (row.reorder_point != null && (!Number.isFinite(row.reorder_point) || row.reorder_point < 0)) {
      validation.errors.push({ row: index + 2, message: "Reorder point must be a valid non-negative number." });
    }
    if (row.min_stock_level != null && (!Number.isFinite(row.min_stock_level) || row.min_stock_level < 0)) {
      validation.errors.push({ row: index + 2, message: "Minimum stock level must be a valid non-negative number." });
    }
  }
  validation.ok = validation.errors.length === 0;

  if (!validation.ok) {
    return NextResponse.json(
      {
        error: "Catalog validation failed. Nothing was imported.",
        errors: validation.errors.slice(0, 100),
        errorCount: validation.errors.length,
      },
      { status: 400 },
    );
  }

  const importId = uid("imp");
  const db = getSupabaseAdmin();

  if (supplierId) {
    const supplier = await db
      .from("stockr_suppliers")
      .select("id")
      .eq("company_id", account.company.id)
      .eq("id", supplierId)
      .eq("enabled", true)
      .eq("approved", true)
      .maybeSingle();
    if (supplier.error) {
      return NextResponse.json({ error: supplier.error.message }, { status: 400 });
    }
    if (!supplier.data) {
      return NextResponse.json(
        { error: "Selected supplier is not an approved supplier for this company." },
        { status: 400 },
      );
    }
  }

  const createdAt = new Date().toISOString();
  const history = await db.from("stockr_catalog_imports").insert({
    id: importId,
    company_id: account.company.id,
    file_name: file.name,
    supplier_id: supplierId,
    status: "pending",
    row_count: rows.length,
    created_count: 0,
    updated_count: 0,
    priced_count: 0,
    error_message: null,
    created_by: account.user.email,
    created_at: createdAt,
    completed_at: null,
  });

  if (history.error) {
    if (migrationMissing(history.error)) {
      return NextResponse.json(
        { error: "Production catalog import migration is required before uploading catalogs." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: history.error.message }, { status: 500 });
  }

  const payload = rows.map((row) => ({
    id: uid("mat"),
    name: row.name.trim(),
    description: row.description || "",
    category: row.category || "",
    sub_category: row.sub_category || "",
    manufacturer: row.manufacturer || "",
    supplier: row.supplier || "",
    unit: row.unit || "each",
    unit_cost: row.unit_cost_raw?.trim() ? Number(row.unit_cost_raw) : null,
    barcode: row.barcode || "",
    mpn: row.mpn || "",
    upc: row.upc || "",
    supplier_number: row.supplier_number || "",
    reorder_point: row.reorder_point,
    min_stock_level: row.min_stock_level,
    image_url: row.image_url || "",
  }));

  const maxMaterials = getPlan(account.company.plan).materials;
  const sourceReference = `Catalog file ${file.name} · import ${importId}`;
  const imported = await db.rpc("stockr_import_catalog_batch", {
    p_company_id: account.company.id,
    p_import_id: importId,
    p_supplier_id: supplierId,
    p_source_reference: sourceReference,
    p_rows: payload,
    p_max_materials: maxMaterials,
  });

  if (imported.error) {
    await db
      .from("stockr_catalog_imports")
      .update({
        status: "failed",
        error_message: imported.error.message.slice(0, 2000),
        completed_at: new Date().toISOString(),
      })
      .eq("company_id", account.company.id)
      .eq("id", importId);

    if (migrationMissing(imported.error)) {
      return NextResponse.json(
        { error: "Production catalog import migration is required before uploading catalogs." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: imported.error.message, importId },
      { status: 400 },
    );
  }

  const summary = (imported.data || {}) as {
    processed?: number;
    created?: number;
    updated?: number;
    priced?: number;
  };
  await db
    .from("stockr_catalog_imports")
    .update({
      status: "completed",
      created_count: Number(summary.created || 0),
      updated_count: Number(summary.updated || 0),
      priced_count: Number(summary.priced || 0),
      completed_at: new Date().toISOString(),
    })
    .eq("company_id", account.company.id)
    .eq("id", importId);

  return NextResponse.json({
    ok: true,
    importId,
    processed: Number(summary.processed || rows.length),
    created: Number(summary.created || 0),
    updated: Number(summary.updated || 0),
    priced: Number(summary.priced || 0),
  });
}
