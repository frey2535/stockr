import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth";
import { getAccount, updateCompanyName } from "@/lib/db";
import type { StoreCommand } from "@/lib/mutations";
import { persistStoreCommand } from "@/lib/persist-command";
import { commandAccessError } from "@/lib/command-access";
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

  const denied = commandAccessError(account.role, command.type);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: 403 });
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

  const seed =
    account.company.id === "co_summit"
      ? createSeedState()
      : createEmptyState(account.company.name);

  const result = await persistStoreCommand(account.company.id, command, account.user.email, seed);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

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
