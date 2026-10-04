import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { listSuppliers, saveSupplier, deleteSupplier, recordVerifiedOffer, listSourcingRules, saveSourcingRule, deleteSourcingRule } from "@/lib/supplier-intelligence";
import type { SupplierOffer, SupplierProfile, SourcingRule } from "@/lib/types";

export const runtime = "nodejs";

function canManage(role?: string) {
  return ["owner", "admin", "inventory_admin", "warehouse_manager"].includes(String(role || ""));
}

export async function GET() {
  const { account, response } = await requireAccount();
  if (!account) return response;
  try {
    return NextResponse.json({ rows: await listSuppliers(account.company.id), rules: await listSourcingRules(account.company.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load suppliers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  if (!canManage(account.role)) {
    return NextResponse.json({ error: "You do not have permission to manage suppliers." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    supplier?: Partial<SupplierProfile> & { name?: string };
    supplierId?: string;
    offer?: Partial<SupplierOffer>;
    rule?: Partial<SourcingRule> & { category?: string };
    ruleId?: string;
  } | null;

  try {
    if (body?.action === "saveSupplier") {
      if (!body.supplier?.name?.trim()) {
        return NextResponse.json({ error: "Supplier name is required." }, { status: 400 });
      }
      const supplier = await saveSupplier(account.company.id, {
        ...body.supplier,
        name: body.supplier.name.trim(),
      });
      return NextResponse.json({ ok: true, supplier, rows: await listSuppliers(account.company.id) });
    }

    if (body?.action === "deleteSupplier") {
      if (!body.supplierId) return NextResponse.json({ error: "Supplier ID is required." }, { status: 400 });
      await deleteSupplier(account.company.id, body.supplierId);
      return NextResponse.json({ ok: true, rows: await listSuppliers(account.company.id) });
    }

    if (body?.action === "saveRule") {
      if (!body.rule?.category?.trim()) return NextResponse.json({ error: "Category is required." }, { status: 400 });
      const rule = await saveSourcingRule(account.company.id, { ...body.rule, category: body.rule.category.trim() });
      return NextResponse.json({ ok: true, rule, rules: await listSourcingRules(account.company.id) });
    }

    if (body?.action === "deleteRule") {
      if (!body.ruleId) return NextResponse.json({ error: "Rule ID is required." }, { status: 400 });
      await deleteSourcingRule(account.company.id, body.ruleId);
      return NextResponse.json({ ok: true, rules: await listSourcingRules(account.company.id) });
    }

    if (body?.action === "recordVerifiedOffer") {
      const offer = body.offer;
      if (!offer?.supplier_id || !offer.product_name || !offer.source_type) {
        return NextResponse.json({ error: "Supplier, product, and verified source are required." }, { status: 400 });
      }
      const saved = await recordVerifiedOffer(account.company.id, {
        supplier_id: offer.supplier_id,
        material_id: offer.material_id || null,
        product_name: offer.product_name,
        manufacturer: offer.manufacturer || null,
        mpn: offer.mpn || null,
        upc: offer.upc || null,
        supplier_sku: offer.supplier_sku || null,
        price: offer.price == null ? null : Number(offer.price),
        currency: offer.currency || "USD",
        unit: offer.unit || null,
        product_url: offer.product_url || null,
        source_type: offer.source_type,
        source_reference: offer.source_reference || null,
        expires_at: offer.expires_at || null,
        exact_match: offer.exact_match === true,
      });
      return NextResponse.json({ ok: true, offer: saved });
    }

    return NextResponse.json({ error: "Unknown supplier action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save supplier data." }, { status: 400 });
  }
}
