import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentAccount } from "@/lib/auth";
import { deleteCompanyWorkspace } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role !== "owner") {
    return NextResponse.json({ error: "Only the company owner can delete this workspace." }, { status: 403 });
  }
  const limited = rateLimit(clientKey(request, `delete:${account.company.id}`), 3, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many delete attempts." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== account.company.name) {
    return NextResponse.json({ error: "Type the company name to confirm deletion." }, { status: 400 });
  }
  await deleteCompanyWorkspace(account.company.id, account.user.id);
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
