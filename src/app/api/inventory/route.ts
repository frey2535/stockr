import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { listInventory } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const url = new URL(request.url);
  return NextResponse.json(
    await listInventory(account.company.id, {
      q: url.searchParams.get("q") || "",
      locationId: url.searchParams.get("location") || "",
      stock: url.searchParams.get("stock") || "",
      limit: Number(url.searchParams.get("limit") || 50),
      offset: Number(url.searchParams.get("offset") || 0),
    }),
  );
}
