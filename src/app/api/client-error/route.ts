import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = await rateLimit(clientKey(request, "client-error"), 20, 15 * 60 * 1000);
  if (!limited.ok) return NextResponse.json({ ok: true });
  const body = (await request.json().catch(() => null)) as {
    message?: string;
    digest?: string;
    path?: string;
  } | null;
  console.error("stockr.client_error", {
    message: String(body?.message || "client error").slice(0, 500),
    digest: body?.digest,
    path: String(body?.path || "").slice(0, 200),
  });
  return NextResponse.json({ ok: true });
}
