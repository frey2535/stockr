import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getCompanyState } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role !== "owner") {
    return NextResponse.json({ error: "Only the company owner can export the workspace." }, { status: 403 });
  }
  const state = await getCompanyState(account.company.id);
  return NextResponse.json({
    exported_at: new Date().toISOString(),
    company: {
      id: account.company.id,
      name: account.company.name,
      plan: account.company.plan,
    },
    members: (account.members || []).map((member) => ({
      email: member.email,
      name: member.name,
      role: member.role,
    })),
    workspace: state,
  });
}
