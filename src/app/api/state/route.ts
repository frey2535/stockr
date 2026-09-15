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
import { getWorkspaceCounts, getWorkspaceShell } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    workspace: await getWorkspaceShell(account.company.id),
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

  const counts = await getWorkspaceCounts(account.company.id);

  if (command.type === "upsertLocation" && !command.location.id) {
    const limit = planLimitError(account.company.plan, counts, "location");
    if (limit) return NextResponse.json({ error: limit }, { status: 403 });
  }
  if (command.type === "upsertMaterial") {
    const isNew = !command.material.id;
    if (isNew) {
      const limit = planLimitError(account.company.plan, counts, "material");
      if (limit) return NextResponse.json({ error: limit }, { status: 403 });
    }
  }
  if (command.type === "upsertMaterials") {
    const newCount = command.materials.filter((row) => !row.id).length;
    for (let i = 0; i < newCount; i += 1) {
      const limit = planLimitError(
        account.company.plan,
        { ...counts, materials: counts.materials + i },
        "material",
      );
      if (limit) return NextResponse.json({ error: limit }, { status: 403 });
    }
  }

  const prev = await getCompanyState(account.company.id);
  const seed =
    account.company.id === "co_summit"
      ? createSeedState()
      : createEmptyState(account.company.name);

  const result = applyCommand(prev, command, account.user.email, seed);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await setCompanyState(account.company.id, result.state);
  if (command.type === "updateSettings" && command.patch.company_name) {
    await updateCompanyName(account.company.id, command.patch.company_name);
  }

  const nextAccount = await getAccount(account.user.id, account.company.id);
  return NextResponse.json({
    workspace: await getWorkspaceShell(account.company.id),
    account: nextAccount,
    created: result.created,
  });
}
