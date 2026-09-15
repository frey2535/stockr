import type { InventoryAction } from "./types";

export const OFFLINE_QUEUE_KEY = "stockr_offline_actions";
export const SCANNER_PREFS_KEY = "stockr_scanner_prefs";

export type QueuedAction = InventoryAction & {
  queueId: string;
  queuedAt: string;
};

export type ScannerPrefs = {
  actionType?: InventoryAction["type"];
  fromId?: string;
  toId?: string;
  project?: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readOfflineQueue(): QueuedAction[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]") as QueuedAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(rows: QueuedAction[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(rows));
}

export function enqueueOfflineAction(action: InventoryAction): QueuedAction {
  const item: QueuedAction = {
    ...action,
    queueId: `off_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  writeOfflineQueue([...readOfflineQueue(), item]);
  return item;
}

export function dropOfflineAction(queueId: string) {
  writeOfflineQueue(readOfflineQueue().filter((row) => row.queueId !== queueId));
}

export async function flushOfflineQueue(
  apply: (action: InventoryAction) => Promise<{ ok: boolean; error?: string }>,
) {
  const pending = readOfflineQueue();
  let flushed = 0;
  for (const item of pending) {
    const { queueId, queuedAt: _queuedAt, ...action } = item;
    const result = await apply(action);
    if (!result.ok) break;
    dropOfflineAction(queueId);
    flushed += 1;
  }
  return { flushed, remaining: readOfflineQueue().length };
}

export function readScannerPrefs(): ScannerPrefs {
  if (!canUseStorage()) return {};
  try {
    return (JSON.parse(localStorage.getItem(SCANNER_PREFS_KEY) || "{}") as ScannerPrefs) || {};
  } catch {
    return {};
  }
}

export function writeScannerPrefs(prefs: ScannerPrefs) {
  if (!canUseStorage()) return;
  localStorage.setItem(SCANNER_PREFS_KEY, JSON.stringify(prefs));
}
