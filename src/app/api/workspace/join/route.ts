import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createSession, joinCompanyByInvite } from "@/lib/db";
import { requireAccount } from "@/lib/require-account";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { account, response } = await requireAccount();
  if (!account || response) return response;

  const body = (await request.json().catch(() => null)) as { inviteCode?: string } | null;
  const inviteCode = body?.inviteCode?.trim() || "";
  if (!inviteCode) {
    return NextResponse.json({ error: "Enter an invite code." }, { status: 400 });
  }

  const result = await joinCompanyByInvite(account.user.id, inviteCode);
  if (!("companyId" in result) || !result.companyId) {
    return NextResponse.json({ error: "error" in result ? result.error : "Could not join that company." }, { status: 400 });
  }

  const session = await createSession(account.user.id, result.companyId);
  await setSessionCookie(session.id, session.expiresAt);
  return NextResponse.json({ ok: true, next: "/dashboard" });
}
