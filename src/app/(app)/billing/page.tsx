"use client";

import { Check, CreditCard } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNativeAndroid, purchasePlayPlan, restorePlayPurchases } from "@/lib/play-billing";
import { playProductId } from "@/lib/play-products";
import { PLANS } from "@/lib/plans";
import { useStore } from "@/lib/store";
import type { Account, PlanId } from "@/lib/types";

function BillingPageInner() {
  const { account, setAccount } = useStore();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [playToken, setPlayToken] = useState("");
  const [playPlan, setPlayPlan] = useState<Exclude<PlanId, "starter">>("pro");
  const current = account?.company.plan || "starter";
  const canChange = account?.role !== "member";
  const nativePlay = isNativeAndroid();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;
    void fetch("/api/billing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { account?: Account; error?: string } | null;
        if (!response.ok) throw new Error(data?.error || "Could not confirm Stripe checkout.");
        if (data?.account) setAccount(data.account);
        toast.success("Stripe subscription is active.");
      })
      .catch((error: Error) => toast.error(error.message));
  }, [searchParams, setAccount]);

  const applyAccount = (next: Account | null | undefined) => {
    if (next) setAccount(next);
  };

  const chooseStripe = async (plan: PlanId) => {
    if (!canChange) {
      toast.error("Ask an owner or admin to change the plan.");
      return;
    }
    setBusy(`stripe-${plan}`);
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      account?: Account;
      url?: string;
      mock?: boolean;
    } | null;
    setBusy(null);
    if (!response.ok) {
      toast.error(data?.error || "Could not start checkout.");
      return;
    }
    if (data?.url) {
      location.assign(data.url);
      return;
    }
    applyAccount(data?.account);
    toast.success(
      plan === "starter"
        ? "Workspace set to Starter."
        : data?.mock
          ? `Upgraded to ${PLANS.find((row) => row.id === plan)?.name}. Add Stripe keys for live PWA checkout.`
          : `Upgraded to ${PLANS.find((row) => row.id === plan)?.name}.`,
    );
  };

  const redeemPlay = async (productId: string, purchaseToken: string) => {
    const response = await fetch("/api/billing/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, purchaseToken }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; account?: Account } | null;
    if (!response.ok) throw new Error(data?.error || "Could not apply the Play purchase.");
    applyAccount(data?.account);
    toast.success("Google Play purchase applied.");
  };

  const buyOnPlay = async (plan: Exclude<PlanId, "starter">) => {
    if (!canChange) {
      toast.error("Ask an owner or admin to change the plan.");
      return;
    }
    setBusy(`play-${plan}`);
    try {
      if (nativePlay) {
        const purchase = await purchasePlayPlan(plan);
        await redeemPlay(purchase.productId, purchase.purchaseToken);
      } else {
        toast.error("Google Play Billing is available in the Android app. Use card checkout on the PWA.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Play purchase failed.");
    } finally {
      setBusy(null);
    }
  };

  const restorePlay = async () => {
    setBusy("restore");
    try {
      if (nativePlay) {
        const restored = await restorePlayPurchases();
        const purchase = restored.purchases[0];
        if (!purchase) throw new Error("No Play purchases to restore.");
        await redeemPlay(purchase.productId, purchase.purchaseToken);
      } else if (playToken.trim()) {
        await redeemPlay(playProductId(playPlan), playToken.trim());
      } else {
        toast.error("Enter a Play purchase token or restore from the Android app.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not restore Play billing.");
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    setBusy(null);
    if (!response.ok || !data?.url) {
      toast.error(data?.error || "Stripe portal is not available yet.");
      return;
    }
    location.assign(data.url);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Pay on the web with Stripe, or use Google Play Billing in the Android app"
        icon={<CreditCard className="size-8 text-primary" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Current workspace
            <Badge className="bg-secondary text-secondary-foreground capitalize">{current}</Badge>
            <Badge variant="outline" className="capitalize">
              {account?.company.planStatus}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {account?.company.name} is on the {PLANS.find((row) => row.id === current)?.name} plan. PWA and
            desktop users pay with Stripe. The Play Store app uses Google Play Billing.
          </p>
          <Button variant="outline" size="sm" onClick={openPortal} disabled={busy !== null}>
            {busy === "portal" ? "Opening…" : "Manage Stripe subscription"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const active = plan.id === current;
          return (
            <Card key={plan.id} className={active ? "border-secondary shadow-md" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  <span className="text-2xl font-bold">${plan.monthlyPrice}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{plan.blurb}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={active ? "outline" : "default"}
                  disabled={active || busy !== null}
                  onClick={() => chooseStripe(plan.id)}
                >
                  {active
                    ? "Current plan"
                    : busy === `stripe-${plan.id}`
                      ? "Starting checkout…"
                      : plan.id === "starter"
                        ? "Switch to Starter"
                        : `Pay with card · ${plan.name}`}
                </Button>
                {plan.id !== "starter" ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={active || busy !== null}
                    onClick={() => buyOnPlay(plan.id === "fleet" ? "fleet" : "pro")}
                  >
                    {busy === `play-${plan.id}` ? "Opening Play…" : `Google Play · ${plan.name}`}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Restore a Google Play purchase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use this if the Android app already charged Play Billing and this workspace still shows Starter.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Play product</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={playPlan}
                onChange={(event) => setPlayPlan(event.target.value as Exclude<PlanId, "starter">)}
              >
                <option value="pro">Pro ({playProductId("pro")})</option>
                <option value="fleet">Fleet ({playProductId("fleet")})</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Purchase token</Label>
              <Input
                value={playToken}
                onChange={(event) => setPlayToken(event.target.value)}
                placeholder="From Play Billing"
              />
            </div>
          </div>
          <Button variant="outline" onClick={restorePlay} disabled={busy !== null}>
            {busy === "restore" ? "Restoring…" : "Restore Play purchase"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}
