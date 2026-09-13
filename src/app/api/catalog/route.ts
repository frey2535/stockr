import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { listCatalog } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const url = new URL(request.url);
  return NextResponse.json(
    await listCatalog(account.company.id, {
      q: url.searchParams.get("q") || "",
      category: url.searchParams.get("category") || "",
      sub: url.searchParams.get("sub") || "",
      limit: Number(url.searchParams.get("limit") || 50),
      offset: Number(url.searchParams.get("offset") || 0),
    }),
  );
}
