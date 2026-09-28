"use client";

import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
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
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        onClick={() => retry()}
      >
        Try again
      </button>
    </div>
  );
}
