import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createSession, ensureCompanyMembership, listCompanies } from "@/lib/db";
import { requirePlatformOwner } from "@/lib/require-account";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { account, response } = await requirePlatformOwner();
  if (!account || response) return response;

  const body = (await request.json().catch(() => null)) as { companyId?: string } | null;
  const companyId = body?.companyId?.trim() || "";
  const companies = await listCompanies();
  const company = companies.find((row) => row.id === companyId);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  await ensureCompanyMembership(account.user.id, company.id, "admin");
  const session = await createSession(account.user.id, company.id);
  await setSessionCookie(session.id, session.expiresAt);
  return NextResponse.json({ ok: true, next: "/dashboard" });
}
