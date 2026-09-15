"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function OpenCompanyButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    const response = await fetch("/api/admin/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    const data = (await response.json().catch(() => null)) as { next?: string; error?: string } | null;
    setBusy(false);
    if (!response.ok) {
      window.alert(data?.error || "Could not open that company.");
      return;
    }
    router.push(data?.next || "/dashboard");
    router.refresh();
  };

  return (
    <Button size="sm" onClick={open} disabled={busy}>
      {busy ? "Opening…" : "Open"}
    </Button>
  );
}
