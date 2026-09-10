import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import {
  getAccount,
  getCompanyState,
  setCompanyState,
  updateCompanyName,
} from "@/lib/db";
import { applyCommand, type StoreCommand } from "@/lib/mutations";
import { planLimitError } from "@/lib/plans";
import { createEmptyState, createSeedState } from "@/lib/seed";

export const runtime = "nodejs";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    state: getCompanyState(account.company.id),
    account,
  });
}

export async function POST(request: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { command?: StoreCommand } | null;
  const command = body?.command;
  if (!command?.type) {
    return NextResponse.json({ error: "Missing command." }, { status: 400 });
  }

  if (command.type === "resetDemo" && account.role !== "owner") {
    return NextResponse.json({ error: "Only the company owner can reset workspace data." }, { status: 403 });
  }

  const prev = getCompanyState(account.company.id);

  if (command.type === "upsertLocation" && !command.location.id) {
    const limit = planLimitError(account.company.plan, prev, "location");
    if (limit) return NextResponse.json({ state: prev, account, error: limit }, { status: 403 });
  }
  if (command.type === "upsertMaterial") {
    const isNew = !command.material.id || !prev.materials.some((row) => row.id === command.material.id);
    if (isNew) {
      const limit = planLimitError(account.company.plan, prev, "material");
      if (limit) return NextResponse.json({ state: prev, account, error: limit }, { status: 403 });
    }
  }

  const seed =
    account.company.id === "co_summit"
      ? createSeedState()
      : createEmptyState(account.company.name);

  const result = applyCommand(prev, command, account.user.email, seed);
  if (result.error) {
    return NextResponse.json(
      { state: prev, account, error: result.error },
      { status: 400 },
    );
  }

  setCompanyState(account.company.id, result.state);
  if (command.type === "updateSettings" && command.patch.company_name) {
    updateCompanyName(account.company.id, command.patch.company_name);
  }

  const nextAccount = getAccount(account.user.id, account.company.id);
  return NextResponse.json({
    state: result.state,
    account: nextAccount,
    created: result.created,
  });
}
