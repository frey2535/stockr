"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  FAMILY_LAUNCH_CHANNEL,
  FAMILY_LAUNCH_COOKIE,
  FAMILY_LAUNCH_RETURN_COOKIE,
  familyLaunchReturnFromCookie,
  familyLaunchReturnUrl,
  familyLaunchShouldYield,
  isFamilyLaunchCookie,
  isFamilyLaunchSearch,
  stripFamilyLaunchSearch,
  type FamilyLaunchInstance,
} from "@/lib/family-launch";

type GuardState = "pass" | "checking" | "yield";

function isStandaloneWindow() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isEmbeddedWindow() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

async function isNativeWindow() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function hasInstalledStockrApp() {
  const nav = navigator as Navigator & {
    getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>;
  };
  if (!nav.getInstalledRelatedApps) return false;
  try {
    const apps = await nav.getInstalledRelatedApps();
    return apps.some((app) => {
      const id = String(app.id || "");
      const url = String(app.url || "");
      return id === "org.currentflowconsulting.stockr" || /stockr/i.test(`${id} ${url}`);
    });
  } catch {
    return false;
  }
}

function clearFamilyLaunchCookie() {
  document.cookie = `${FAMILY_LAUNCH_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${FAMILY_LAUNCH_RETURN_COOKIE}=; path=/; max-age=0`;
}

function clearFamilyLaunchSearch() {
  const next = stripFamilyLaunchSearch(window.location.href);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
}

export function FamilyLaunchGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("checking");
  const [returnUrl, setReturnUrl] = useState("");

  useEffect(() => {
    const fromSearch = isFamilyLaunchSearch(window.location.search);
    const fromCookie = isFamilyLaunchCookie(document.cookie);
    if (!fromSearch && !fromCookie) {
      setState("pass");
      return;
    }

    let cancelled = false;
    const peers: FamilyLaunchInstance[] = [];
    const self: FamilyLaunchInstance = {
      id: crypto.randomUUID(),
      fromFamilyLaunch: true,
      native: false,
      standalone: isStandaloneWindow(),
      hasOpener: Boolean(window.opener),
      embedded: isEmbeddedWindow(),
      launchedAt: Date.now(),
    };

    const channel =
      "BroadcastChannel" in window ? new BroadcastChannel(FAMILY_LAUNCH_CHANNEL) : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ type?: string; instance?: FamilyLaunchInstance }>) => {
        const instance = event.data?.instance;
        if (!instance?.id || instance.id === self.id) return;
        peers.push(instance);
        if (event.data?.type === "announce") {
          channel.postMessage({ type: "present", instance: self });
        }
      };
    }

    const finish = (keep: boolean) => {
      if (cancelled) return;
      const back =
        familyLaunchReturnFromCookie(document.cookie) || familyLaunchReturnUrl(document.referrer);
      clearFamilyLaunchCookie();
      if (keep) {
        clearFamilyLaunchSearch();
        setState("pass");
        return;
      }
      if (back) {
        window.location.replace(back);
        return;
      }
      setReturnUrl("");
      setState("yield");
    };

    void (async () => {
      self.native = await isNativeWindow();
      if (channel) channel.postMessage({ type: "announce", instance: self });
      const installed = await hasInstalledStockrApp();
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (cancelled) return;
      finish(!familyLaunchShouldYield(self, peers, installed));
    })();

    return () => {
      cancelled = true;
      channel?.close();
    };
  }, []);

  if (state === "pass") return children;

  if (state === "yield") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <BrandMark />
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold">Stockr is open in the app</h1>
          <p className="text-sm text-muted-foreground">
            The Family App button should open Stockr once. Return to Buildr — do not keep a second
            copy here.
          </p>
        </div>
        {returnUrl ? (
          <Button asChild>
            <a href={returnUrl}>Back to Buildr</a>
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => {
            clearFamilyLaunchCookie();
            clearFamilyLaunchSearch();
            setState("pass");
          }}
        >
          Continue in this window
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Opening Stockr…
    </div>
  );
}
