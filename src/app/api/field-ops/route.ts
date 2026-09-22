import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import {
  createBin,
  createMaterialRequest,
  createReservation,
  createZone,
  getFieldOps,
  releaseReservation,
  setMaterialRequestStatus,
  startCycleCount,
  submitCycleCount,
  updateCycleCountLine,
} from "@/lib/field-ops";

export const runtime = "nodejs";

export async function GET() {
  const { account, response } = await requireAccount();
  if (!account) return response;
  try {
    return NextResponse.json(await getFieldOps(account.company.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load field operations." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const body = (await request.json().catch(() => null)) as { action?: string; [key: string]: unknown } | null;
  if (!body?.action) return NextResponse.json({ error: "Missing action." }, { status: 400 });

  try {
    let result: unknown = null;
    if (body.action === "createZone") {
      result = await createZone(account.company.id, {
        locationId: String(body.locationId || ""),
        name: String(body.name || ""),
        code: String(body.code || ""),
      });
    } else if (body.action === "createBin") {
      result = await createBin(account.company.id, {
        locationId: String(body.locationId || ""),
        zoneId: body.zoneId ? String(body.zoneId) : undefined,
        name: String(body.name || ""),
        code: String(body.code || ""),
        barcode: body.barcode ? String(body.barcode) : undefined,
        description: body.description ? String(body.description) : undefined,
      });
    } else if (body.action === "reserve") {
      result = await createReservation(account.company.id, account.user.email, {
        materialId: String(body.materialId || ""),
        locationId: String(body.locationId || ""),
        projectId: body.projectId ? String(body.projectId) : undefined,
        quantity: Number(body.quantity || 0),
        notes: body.notes ? String(body.notes) : undefined,
      });
    } else if (body.action === "releaseReservation") {
      await releaseReservation(account.company.id, String(body.reservationId || ""));
    } else if (body.action === "createRequest") {
      result = await createMaterialRequest(account.company.id, account.user.email, {
        projectId: body.projectId ? String(body.projectId) : undefined,
        destinationLocationId: body.destinationLocationId ? String(body.destinationLocationId) : undefined,
        priority: (body.priority as "normal" | "urgent" | "critical") || "normal",
        notes: body.notes ? String(body.notes) : undefined,
        lines: Array.isArray(body.lines)
          ? body.lines.map((line) => ({
              materialId: String((line as { materialId?: unknown }).materialId || ""),
              quantity: Number((line as { quantity?: unknown }).quantity || 0),
            }))
          : [],
      });
    } else if (body.action === "setRequestStatus") {
      await setMaterialRequestStatus(
        account.company.id,
        String(body.requestId || ""),
        body.status as "requested" | "approved" | "picking" | "staged" | "in_transit" | "fulfilled" | "cancelled",
      );
    } else if (body.action === "startCount") {
      result = await startCycleCount(account.company.id, account.user.email, {
        locationId: String(body.locationId || ""),
        zoneId: body.zoneId ? String(body.zoneId) : undefined,
        binId: body.binId ? String(body.binId) : undefined,
      });
    } else if (body.action === "countLine") {
      await updateCycleCountLine(
        account.company.id,
        String(body.sessionId || ""),
        String(body.materialId || ""),
        Number(body.countedQuantity || 0),
      );
    } else if (body.action === "submitCount") {
      await submitCycleCount(account.company.id, account.user.email, String(body.sessionId || ""));
    } else {
      return NextResponse.json({ error: "Unknown field operation." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result, fieldOps: await getFieldOps(account.company.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save field operation." }, { status: 400 });
  }
}
