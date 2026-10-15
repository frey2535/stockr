import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { submitProcurementRequest } from "@/lib/procurement";
import { tenantMismatchError } from "@/lib/procurement-policy";

export const runtime = "nodejs";

/**
 * Buildr → Stockr request intake. Uses the signed-in company, never a
 * client-supplied company_id, and never fabricates supplier prices.
 */
export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;

  const body = (await request.json().catch(() => null)) as {
    company_id?: string;
    request_type?: string;
    event_id?: string;
    buildr_request_id?: string;
    project_id?: string;
    destination_location_id?: string;
    priority?: "normal" | "urgent" | "critical";
    notes?: string;
    lines?: Array<{ stockr_material_id?: string; materialId?: string; quantity?: number }>;
  } | null;
  if (!body) return NextResponse.json({ error: "Missing procurement payload." }, { status: 400 });

  const mismatch = tenantMismatchError(account.company.id, body.company_id || "");
  if (mismatch) return NextResponse.json({ error: mismatch }, { status: 403 });

  try {
    const created = await submitProcurementRequest(account.company.id, account.user.email, {
      requestType: body.request_type,
      projectId: body.project_id,
      destinationLocationId: body.destination_location_id,
      priority: body.priority,
      notes: body.notes,
      eventId: body.event_id,
      buildrRequestId: body.buildr_request_id,
      payloadCompanyId: body.company_id,
      lines: (body.lines || []).map((line) => ({
        materialId: String(line.stockr_material_id || line.materialId || ""),
        quantity: Number(line.quantity || 0),
      })),
    });
    return NextResponse.json({
      ok: true,
      contract_version: created.contract_version,
      request: created,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not accept the procurement request." },
      { status: 400 },
    );
  }
}
