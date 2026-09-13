import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { lookupMaterials } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const url = new URL(request.url);
  return NextResponse.json(
    await lookupMaterials(account.company.id, {
      barcode: url.searchParams.get("barcode") || "",
      q: url.searchParams.get("q") || "",
      limit: Number(url.searchParams.get("limit") || 20),
    }),
  );
}
