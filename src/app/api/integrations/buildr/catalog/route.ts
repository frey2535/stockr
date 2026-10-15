import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listCatalog } from "@/lib/workspace-data";

export const runtime = "nodejs";

/** Buildr-to-Stockr server-to-server catalog access; never trust client company IDs. */
export async function GET(request: Request) {
  const secret = process.env.STOCKR_BUILDR_SHARED_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "integration_not_configured" }, { status: 503 });
  const url = new URL(request.url);
  const companyId = url.searchParams.get("company_id") || "";
  const timestamp = request.headers.get("x-buildr-timestamp") || "";
  const signature = request.headers.get("x-buildr-signature") || "";
  const issuedAt = Number(timestamp);
  if (!companyId || !/^\d{10}$/.test(timestamp) || !Number.isFinite(issuedAt) || Math.abs(Date.now() / 1000 - issuedAt) > 120) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const expected = createHmac("sha256", secret).update(`GET\n/api/integrations/buildr/catalog\n${url.searchParams.toString()}\n${timestamp}`).digest("hex");
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const db = getSupabaseAdmin();
    const { data: companies, error } = await db.from("stockr_buildr_tenant_bindings")
      .select("stockr_company_id").eq("buildr_company_id", companyId).eq("is_active", true).limit(2);
    if (error) throw new Error(error.message);
    if (!companies || companies.length !== 1 || !companies[0].stockr_company_id) {
      return NextResponse.json({ error: "tenant_binding_not_found" }, { status: 404 });
    }
    const data = await listCatalog(companies[0].stockr_company_id, {
      q: url.searchParams.get("q") || "",
      category: url.searchParams.get("category") || "",
      limit: Math.min(Math.max(Number(url.searchParams.get("limit") || 50) || 50, 1), 100),
      offset: Math.max(Number(url.searchParams.get("offset") || 0) || 0, 0),
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Buildr catalog integration failed", error);
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}
