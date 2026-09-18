import { useEffect, useState } from "react";

const BUILD = import.meta.env.VITE_APP_BUILD;

function wantsPreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("update_now") === "1";
}

export default function UpdateAvailableDialog({ appName = "this app" }) {
  const [open, setOpen] = useState(wantsPreview);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wantsPreview()) {
      setOpen(true);
      return undefined;
    }
    if (import.meta.env.DEV || !BUILD) return undefined;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const remote = data.build || data.id;
        if (!cancelled && remote && remote !== BUILD) setOpen(true);
      } catch {
        /* offline or not deployed yet */
      }
    };

    check();
    const timer = window.setInterval(check, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  const applyUpdate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      /* reload still proceeds */
    }
    const next = new URL(window.location.href);
    next.searchParams.delete("update_now");
    next.searchParams.set("t", String(Date.now()));
    window.location.replace(next.toString());
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-gray-900 shadow-2xl">
        <h2 id="app-update-title" className="text-lg font-bold">
          Update available
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          A newer version of {appName} is ready. Update now to get the latest changes.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Later
          </button>
          <button
            type="button"
            onClick={applyUpdate}
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Updating..." : "Update now"}
          </button>
        </div>
      </div>
    </div>
  );
}
