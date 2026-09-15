import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  Package,
  ScanLine,
  Truck,
  Warehouse,
} from "lucide-react";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { getCurrentAccount } from "@/lib/auth";
import { PLANS } from "@/lib/plans";

const FEATURES = [
  {
    title: "Scan on the job",
    body: "Camera or keypad barcode lookup, plus plain-English moves like “add 25 screws to Truck 12”.",
    icon: ScanLine,
  },
  {
    title: "Shops and trucks",
    body: "See what is on the rack versus what left in a van. Transfer stock before the crew rolls out.",
    icon: Truck,
  },
  {
    title: "Receiving that sticks",
    body: "Purchase orders from draft through partial receive. Counts land in the right warehouse.",
    icon: Package,
  },
  {
    title: "Reports you can send",
    body: "Valuation, usage by job, and shrinkage exports so the office is not chasing clipboards.",
    icon: BarChart3,
  },
];

export default async function LandingPage() {
  const account = await getCurrentAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader signedIn={Boolean(account)} />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="space-y-6">
          <p className="text-sm font-semibold tracking-wide text-primary">
            Field inventory for contractors
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Know what is on the truck before the crew leaves the shop.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Stockr is a company workspace for warehouses and service fleets. Scan barcodes,
            transfer material, receive POs, and invite your team — each company on its own plan.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {account ? (
              <Button asChild size="lg">
                <Link href="/dashboard">
                  Continue to {account.company.name}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/signup">
                    Create your company
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Demo workspace: <span className="font-mono text-foreground">demo@stockr.app</span> /{" "}
            <span className="font-mono text-foreground">demo1234</span>
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-primary/5">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Warehouse className="size-4 text-primary" />
            Summit Electric · Fleet plan
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["On hand", "4,234"],
              ["Trucks", "2"],
              ["Low stock", "3"],
              ["Open POs", "2"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-primary/10 p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            New companies start empty on Starter. The demo account is preloaded so you can click
            around before you import your own catalog.
          </p>
        </div>
      </section>

      <section id="product" className="border-t border-border bg-muted/50 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <feature.icon className="mb-3 size-6 text-primary" />
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold">Plans that match a shop, not a spreadsheet.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Start free. Upgrade when you add trucks or seats. Billing here is a local checkout so you
          can try upgrades without a Stripe key.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.id === "pro"
                  ? "border-brand bg-brand/10"
                  : "border-border bg-card"
              }`}
            >
              <p className="text-sm font-semibold text-brand">{plan.name}</p>
              <p className="mt-2 text-4xl font-extrabold">
                ${plan.monthlyPrice}
                <span className="text-base font-medium text-muted-foreground">/mo</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{plan.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6">
                <Link href={account ? "/billing" : "/signup"}>{account ? "Manage plan" : "Get started"}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
