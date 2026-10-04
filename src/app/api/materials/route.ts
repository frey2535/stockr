import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { lookupMaterials } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const url = new URL(request.url);
  const barcode = url.searchParams.get("barcode") || "";
  try {
    return NextResponse.json(
      await lookupMaterials(account.company.id, {
        barcode,
        q: url.searchParams.get("q") || "",
        limit: Number(url.searchParams.get("limit") || 20),
      }),
    );
  } catch (error) {
    console.error("GET /api/materials", error);
    return NextResponse.json({
      rows: [],
      onHandByLocation: {},
      identified: barcode ? { name: "", barcode, upc: barcode, source: "scan" } : null,
    });
  }
}
