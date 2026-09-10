import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getAccount, setCompanyPlan } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import type { PlanId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (account.role === "member") {
    return NextResponse.json({ error: "Only owners and admins can change the plan." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: PlanId } | null;
  const plan = PLANS.find((row) => row.id === body?.plan);
  if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });

  await setCompanyPlan(account.company.id, plan.id);
  return NextResponse.json({
    ok: true,
    mock: true,
    account: await getAccount(account.user.id, account.company.id),
  });
}
