import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createCompanyWithOwner, createSession } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    name?: string;
    password?: string;
    companyName?: string;
    inviteCode?: string;
  } | null;

  const email = body?.email?.trim() || "";
  const password = body?.password || "";
  const inviteCode = body?.inviteCode?.trim();
  const companyName = body?.companyName?.trim();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  if (!inviteCode && !companyName) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }

  const result = await createCompanyWithOwner({
    email,
    name: body?.name?.trim() || email.split("@")[0],
    password,
    companyName: companyName || "My company",
    inviteCode,
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if (!("userId" in result) || !result.userId || !result.companyId) {
    return NextResponse.json({ error: "Could not create the account." }, { status: 400 });
  }

  const session = await createSession(result.userId, result.companyId);
  await setSessionCookie(session.id, session.expiresAt);
  return NextResponse.json({ ok: true });
}
