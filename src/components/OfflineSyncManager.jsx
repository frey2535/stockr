import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { getQueue, removeFromQueue, getQueueLength } from "@/lib/offlineQueue";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import { toast } from "sonner";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";

export default function OfflineSyncManager() {
  const online = useOnlineStatus();
  const { activeCompanyId } = useUserCompanyId();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(getQueueLength());
  const [syncing, setSyncing] = useState(false);
  const wasOffline = useRef(false);

  // Track when we go offline so we only replay on the offline→online transition
  useEffect(() => {
    if (!online) wasOffline.current = true;
  }, [online]);

  const invalidateAll = useCallback(() => {
    if (!activeCompanyId) return;
    queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
    queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
    queryClient.invalidateQueries({ queryKey: ["materials", activeCompanyId] });
  }, [queryClient, activeCompanyId]);

  const replayQueue = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    let succeeded = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        const response = await base44.functions.invoke("processInventoryAction", item.payload);
        if (response?.data?.error) {
          failed++;
          break;
        }
        removeFromQueue(item._id);
        succeeded++;
      } catch (err) {
        // Stop on first failure — likely still flaky; will retry on next online event
        failed++;
        break;
      }
    }
    setPendingCount(getQueueLength());
    setSyncing(false);
    if (succeeded > 0) {
      toast.success(`Synced ${succeeded} offline action${succeeded !== 1 ? "s" : ""}`);
      invalidateAll();
    }
    if (failed > 0 && succeeded === 0) {
      toast.error("Could not sync offline actions — will retry");
    }
  }, [invalidateAll]);

  // Replay when we transition back online
  useEffect(() => {
    if (online && wasOffline.current) {
      wasOffline.current = false;
      replayQueue();
    }
  }, [online, replayQueue]);

  // Expose a manual retry via a custom event so other components can trigger sync
  useEffect(() => {
    const handler = () => { if (navigator.onLine) replayQueue(); };
    window.addEventListener("stockr:retry-offline-sync", handler);
    return () => window.removeEventListener("stockr:retry-offline-sync", handler);
  }, [replayQueue]);

  // Refresh pending count when window regains focus
  useEffect(() => {
    const onFocus = () => setPendingCount(getQueueLength());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const showBanner = !online || syncing || pendingCount > 0;
  if (!showBanner) return null;

  return (
    <div
      className="fixed top-14 lg:top-0 left-0 right-0 lg:left-64 z-40 px-3 py-2 flex items-center justify-between gap-2 text-sm shadow-md"
      style={{
        background: syncing ? "#0d1117" : (!online ? "#7c2d12" : "#0d1117"),
        color: "#fff",
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {syncing ? (
          <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
        ) : !online ? (
          <WifiOff className="w-4 h-4 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-orange-400" />
        )}
        <span className="truncate">
          {syncing
            ? "Syncing offline actions…"
            : !online
              ? `Offline — ${pendingCount} action${pendingCount !== 1 ? "s" : ""} queued`
              : `${pendingCount} action${pendingCount !== 1 ? "s" : ""} pending sync`}
        </span>
      </div>
      {online && !syncing && pendingCount > 0 && (
        <button
          onClick={() => replayQueue()}
          className="text-xs font-semibold underline hover:no-underline flex-shrink-0"
        >
          Sync now
        </button>
      )}
    </div>
  );
}