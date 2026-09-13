import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { getReports } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { account, response } = await requireAccount();
  if (!account) return response;
  const url = new URL(request.url);
  return NextResponse.json(
    await getReports(account.company.id, {
      from: url.searchParams.get("from") || "",
      to: url.searchParams.get("to") || "",
    }),
  );
}
