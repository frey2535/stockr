import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db-config";
import { playBillingConfigured, productionBlockers, stripeBillingConfigured } from "@/lib/production-ready";

export const runtime = "nodejs";

export async function GET() {
  const blockers = productionBlockers();
  let bumpReady = false;
  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
      const { error } = await getSupabaseAdmin().from("stockr_users").select("id").limit(1);
      if (error) blockers.push("Stockr tables are missing. Run supabase/schema.sql.");
      const rpc = await getSupabaseAdmin().rpc("stockr_bump_inventory", {
        p_company_id: "__stockr_ready_probe__",
        p_material_id: "probe",
        p_location_id: "probe",
        p_delta: 0,
      });
      bumpReady = !rpc.error || /unknown company|not enough/i.test(rpc.error.message || "");
    } catch {
      blockers.push("Could not reach Supabase.");
    }
  }
  return NextResponse.json({
    ok: blockers.length === 0,
    stripe: stripeBillingConfigured(),
    play: playBillingConfigured(),
    inventoryRpc: bumpReady,
    blockers,
  });
}
