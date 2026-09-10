import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getCurrentAccount } from "@/lib/auth";
import { getCompanyState } from "@/lib/db";
import { StoreProvider } from "@/lib/store";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  const state = getCompanyState(account.company.id);

  return (
    <StoreProvider initialState={state} initialAccount={account}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
