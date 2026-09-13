import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { getDashboard } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET() {
  const { account, response } = await requireAccount();
  if (!account) return response;
  return NextResponse.json(await getDashboard(account.company.id));
}
