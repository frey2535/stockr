"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import {
  registerAppUpdateWatcher,
  reloadFresh,
  UPDATE_EVENT,
  type AppUpdateDetail,
} from "@/lib/app-update";

export function UpdateAvailablePrompt() {
  const [update, setUpdate] = useState<AppUpdateDetail | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<AppUpdateDetail>).detail;
      setUpdate(detail || { targetSha: "", required: false, applyUpdate: () => reloadFresh() });
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    const stop = registerAppUpdateWatcher();
    return () => {
      stop();
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (applying) return;
    setApplying(true);
    try {
      if (typeof update?.applyUpdate === "function") {
        await update.applyUpdate();
        return;
      }
    } catch {
      /* hard reload below */
    }
    await reloadFresh(update?.targetSha);
  }, [applying, update]);

  useEffect(() => {
    if (!update?.required || applying) return undefined;
    const timer = window.setTimeout(() => {
      void applyUpdate();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [applyUpdate, applying, update]);

  if (!update) return null;

  return (
    <div className="fixed right-3 bottom-24 left-3 z-[80] sm:right-5 sm:bottom-5 sm:left-auto sm:max-w-sm">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <RefreshCw className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Update available</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A newer version of Stockr is ready.{" "}
              {update.required
                ? "It will install automatically so barcode lookup and the rest of the app stay current."
                : "Update to get the latest inventory and scanner fixes."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void applyUpdate()}
                disabled={applying}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {applying ? "Updating…" : "Update now"}
              </button>
              {!update.required ? (
                <button
                  type="button"
                  onClick={() => setUpdate(null)}
                  className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/80"
                >
                  Later
                </button>
              ) : null}
            </div>
          </div>
          {!update.required ? (
            <button
              type="button"
              onClick={() => setUpdate(null)}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Dismiss update"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
