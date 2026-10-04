import { NextResponse } from "next/server";
import { requireAccount } from "@/lib/require-account";
import { emptyWorkspaceShell, getWorkspaceShell } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET() {
  const { account, response } = await requireAccount();
  if (!account) return response;
  try {
    return NextResponse.json({
      workspace: await getWorkspaceShell(account.company.id),
      account,
    });
  } catch (error) {
    console.error("GET /api/workspace", error);
    return NextResponse.json({
      workspace: emptyWorkspaceShell(account.company.name),
      account,
      error: error instanceof Error ? error.message : "workspace failed",
    });
  }
}
