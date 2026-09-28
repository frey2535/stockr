import { NextResponse } from "next/server";
import { consumePasswordReset } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimit(clientKey(request, "reset"), 8, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
  const token = String(body?.token || "").trim();
  const password = String(body?.password || "");
  if (!token) return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
  if (password.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }
  const result = await consumePasswordReset(token, password);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
