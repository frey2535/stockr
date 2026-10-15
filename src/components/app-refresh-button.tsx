"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshApp } from "@/lib/app-update";
import { cn } from "@/lib/utils";

export function AppRefreshButton({
  className,
  label = "Refresh",
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    toast.dismiss();
    toast.message("Refreshing Stockr and applying the latest update…");
    try {
      await refreshApp();
    } catch {
      setRefreshing(false);
      toast.error("Could not refresh. Check the connection and try again.");
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={refreshing}
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/80 disabled:opacity-60",
          className,
        )}
        aria-label="Refresh app and apply updates"
        title="Refresh app and apply updates"
      >
        <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void onRefresh()}
      disabled={refreshing}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
        className,
      )}
    >
      <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
      {refreshing ? "Refreshing…" : label}
    </button>
  );
}
