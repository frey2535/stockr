"use client";

import { useEffect, useState } from "react";
import { refreshApp } from "@/lib/app-update";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        path: typeof location !== "undefined" ? location.pathname : "",
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-8">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message || "Reload this page and try again."}</p>
      <button
        type="button"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true);
          void refreshApp().finally(() => setRefreshing(false));
        }}
      >
        {refreshing ? "Refreshing…" : "Refresh app"}
      </button>
    </div>
  );
}
