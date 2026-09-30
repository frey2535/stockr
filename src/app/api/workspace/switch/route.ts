import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createSession } from "@/lib/db";
import { requireAccount } from "@/lib/require-account";
import { canSwitchWorkspace } from "@/lib/tenants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account || response) return response;

  const body = (await request.json().catch(() => null)) as { companyId?: string } | null;
  const companyId = body?.companyId?.trim() || "";
  if (
    !canSwitchWorkspace({
      companyId,
      workspaces: account.workspaces || [],
    })
  ) {
    return NextResponse.json({ error: "You do not have access to that company." }, { status: 403 });
  }

  const session = await createSession(account.user.id, companyId);
  await setSessionCookie(session.id, session.expiresAt);
  return NextResponse.json({ ok: true, next: "/dashboard" });
}
