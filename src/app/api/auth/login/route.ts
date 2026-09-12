import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createSession, verifyPassword } from "@/lib/db";
import { isFormRequest, requestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", requestOrigin(request)), 303);
}

export async function POST(request: Request) {
  const form = isFormRequest(request);
  let email = "";
  let password = "";
  let nextPath = "/dashboard";

  if (form) {
    const data = await request.formData().catch(() => null);
    email = String(data?.get("email") || "");
    password = String(data?.get("password") || "");
    const next = String(data?.get("next") || "/dashboard");
    nextPath = next.startsWith("/") ? next : "/dashboard";
  } else {
    const body = (await request.json().catch(() => null)) as {
      email?: string;
      password?: string;
      next?: string;
    } | null;
    email = body?.email || "";
    password = body?.password || "";
    if (body?.next?.startsWith("/")) nextPath = body.next;
  }

  const match = await verifyPassword(email, password);
  if (!match) {
    if (form) {
      const url = new URL("/login", requestOrigin(request));
      url.searchParams.set("error", "1");
      if (nextPath !== "/dashboard") url.searchParams.set("next", nextPath);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const session = await createSession(match.userId, match.companyId);
  await setSessionCookie(session.id, session.expiresAt);
  if (form) {
    return NextResponse.redirect(new URL(nextPath, requestOrigin(request)), 303);
  }
  return NextResponse.json({ ok: true });
}
