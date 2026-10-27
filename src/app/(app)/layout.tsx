import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { FamilyLaunchGuard } from "@/components/family-launch-guard";
import { UpdateAvailablePrompt } from "@/components/update-available-prompt";
import { getCurrentAccount } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { emptyWorkspaceShell, getWorkspaceShell } from "@/lib/workspace-data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let account;
  try {
    account = await getCurrentAccount();
  } catch (error) {
    console.error("getCurrentAccount", error);
    redirect("/login");
  }
  if (!account) redirect("/login");
  let workspace;
  try {
    workspace = await getWorkspaceShell(account.company.id);
  } catch (error) {
    console.error("getWorkspaceShell", error);
    workspace = emptyWorkspaceShell(account.company.name);
  }

  return (
    <StoreProvider initialWorkspace={workspace} initialAccount={account}>
      <FamilyLaunchGuard>
        <AppShell>{children}</AppShell>
        <UpdateAvailablePrompt />
      </FamilyLaunchGuard>
    </StoreProvider>
  );
}
