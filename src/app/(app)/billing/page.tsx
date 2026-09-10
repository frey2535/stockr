"use client";

import { Check, CreditCard } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANS } from "@/lib/plans";
import { useStore } from "@/lib/store";
import type { PlanId } from "@/lib/types";

export default function BillingPage() {
  const { account, setAccount } = useStore();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const current = account?.company.plan || "starter";
  const canChange = account?.role !== "member";

  const choose = async (plan: PlanId) => {
    if (!canChange) {
      toast.error("Ask an owner or admin to change the plan.");
      return;
    }
    setBusy(plan);
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      account?: typeof account;
    } | null;
    setBusy(null);
    if (!response.ok) {
      toast.error(data?.error || "Could not update the plan.");
      return;
    }
    if (data?.account) setAccount(data.account);
    toast.success(
      plan === "starter"
        ? "Workspace set to Starter."
        : `Upgraded to ${PLANS.find((row) => row.id === plan)?.name}. Checkout is mocked until Stripe is connected.`,
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Company plan, seats, and location limits"
        icon={<CreditCard className="size-8 text-secondary" />}
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
        <CardContent className="text-sm text-muted-foreground">
          {account?.company.name} is on the {PLANS.find((row) => row.id === current)?.name} plan.
          Card charges are not collected in this environment — choosing a paid plan activates it
          immediately so you can test limits.
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
                      <Check className="mt-0.5 size-4 shrink-0 text-secondary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={active ? "outline" : "default"}
                  disabled={active || busy !== null}
                  onClick={() => choose(plan.id)}
                >
                  {active ? "Current plan" : busy === plan.id ? "Updating…" : `Choose ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
