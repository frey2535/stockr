import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getCurrentAccount } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import { getWorkspaceShell } from "@/lib/workspace-data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  const workspace = await getWorkspaceShell(account.company.id);

  return (
    <StoreProvider initialWorkspace={workspace} initialAccount={account}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
