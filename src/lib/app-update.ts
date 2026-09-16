import { shouldOfferUpdate } from "./build-version";

export const UPDATE_EVENT = "stockr-update-available";
export const SEEN_SHA_KEY = "stockr_build_sha";
export const UPDATE_IN_PROGRESS_KEY = "stockr_update_in_progress";

export type AppUpdateDetail = {
  targetSha: string;
  required: boolean;
  applyUpdate: () => void | Promise<void>;
};

declare global {
  interface Window {
    __stockrPendingUpdate?: AppUpdateDetail;
  }
}

export function clientBuildSha() {
  return process.env.NEXT_PUBLIC_STOCKR_BUILD_SHA || "";
}

function readSeenSha() {
  try {
    return window.localStorage.getItem(SEEN_SHA_KEY) || "";
  } catch {
    return "";
  }
}

function writeSeenSha(sha: string) {
  try {
    window.localStorage.setItem(SEEN_SHA_KEY, sha);
  } catch {
    /* private mode */
  }
}

function runningSha() {
  return clientBuildSha() || readSeenSha();
}

function isInstalledApp() {
  if (typeof window === "undefined") return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return standalone;
}

async function isNativeApp() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function dispatchAppUpdate(detail: AppUpdateDetail) {
  window.__stockrPendingUpdate = detail;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail }));
}

export async function reloadFresh(targetSha?: string) {
  try {
    sessionStorage.setItem(UPDATE_IN_PROGRESS_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
  if (targetSha) writeSeenSha(targetSha);
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* cache clearing is best-effort */
  }
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("t", String(Date.now()));
  if (targetSha) nextUrl.searchParams.set("build", targetSha);
  window.location.replace(nextUrl.toString());
}

async function readRemoteVersion() {
  const urls = [`/api/version?t=${Date.now()}`, `/build-version.json?t=${Date.now()}`];
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const data = (await response.json()) as { sha?: string };
      if (data?.sha) return data.sha;
    } catch {
      /* try the next source */
    }
  }
  return "";
}

export function registerAppUpdateWatcher() {
  if (typeof window === "undefined") return () => undefined;

  let promptedSha = "";
  let cancelled = false;

  const check = async () => {
    if (cancelled) return;
    try {
      const remote = await readRemoteVersion();
      if (!remote || remote === promptedSha) return;
      const current = runningSha();
      if (!current || current === "local") {
        writeSeenSha(remote);
        return;
      }
      if (!shouldOfferUpdate(current, remote)) {
        writeSeenSha(remote);
        return;
      }
      promptedSha = remote;
      const required = isInstalledApp() || (await isNativeApp());
      dispatchAppUpdate({
        targetSha: remote,
        required,
        applyUpdate: () => reloadFresh(remote),
      });
    } catch {
      /* never interrupt field work */
    }
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") void check();
  };

  void check();
  const boot = window.setTimeout(check, 2000);
  const interval = window.setInterval(check, isInstalledApp() ? 20 * 1000 : 60 * 1000);
  window.addEventListener("focus", check);
  window.addEventListener("pageshow", check);
  document.addEventListener("visibilitychange", onVisible);

  let removeNative: (() => void) | undefined;
  void import("@capacitor/app")
    .then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void check();
      }),
    )
    .then((handle) => {
      if (!handle) return;
      if (cancelled) {
        void handle.remove();
        return;
      }
      removeNative = () => {
        void handle.remove();
      };
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    window.clearTimeout(boot);
    window.clearInterval(interval);
    window.removeEventListener("focus", check);
    window.removeEventListener("pageshow", check);
    document.removeEventListener("visibilitychange", onVisible);
    removeNative?.();
  };
}
