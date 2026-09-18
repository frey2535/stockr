import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { listActivity } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const url = new URL(request.url);
  return NextResponse.json(
    await listActivity(account.company.id, {
      q: url.searchParams.get("q") || "",
      type: url.searchParams.get("type") || "",
      limit: Number(url.searchParams.get("limit") || 50),
      offset: Number(url.searchParams.get("offset") || 0),
    }),
  );
}
