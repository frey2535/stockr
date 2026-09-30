"use client";

import { useState } from "react";
import { invalidateApiCache } from "@/lib/api-cache";
import type { Account } from "@/lib/types";

export function WorkspaceSwitcher({ account }: { account: Account }) {
  const workspaces = account.workspaces || [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (workspaces.length <= 1) {
    return (
      <div className="px-3 py-1">
        <p className="truncate text-xs font-medium text-foreground">{account.company.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{account.user.email}</p>
      </div>
    );
  }

  const switchWorkspace = async (companyId: string) => {
    if (!companyId || companyId === account.company.id) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/workspace/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    const data = (await response.json().catch(() => null)) as { next?: string; error?: string } | null;
    if (!response.ok) {
      setBusy(false);
      setError(data?.error || "Could not switch companies.");
      return;
    }
    invalidateApiCache();
    window.location.assign(data?.next || "/dashboard");
  };

  return (
    <div className="space-y-1 px-3 py-1">
      <label className="sr-only" htmlFor="workspace-switcher">
        Company workspace
      </label>
      <select
        id="workspace-switcher"
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs font-medium"
        value={account.company.id}
        disabled={busy}
        onChange={(event) => void switchWorkspace(event.target.value)}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <p className="truncate text-[11px] text-muted-foreground">{account.user.email}</p>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
