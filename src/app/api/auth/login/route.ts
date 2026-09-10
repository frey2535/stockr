import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createSession, verifyPassword } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const match = await verifyPassword(body?.email || "", body?.password || "");
  if (!match) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const session = await createSession(match.userId, match.companyId);
  await setSessionCookie(session.id, session.expiresAt);
  return NextResponse.json({ ok: true });
}
