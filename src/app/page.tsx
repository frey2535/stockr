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
    <div className="min-h-screen bg-[#0d1117] text-white">
      <MarketingHeader signedIn={Boolean(account)} />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="space-y-6">
          <p className="text-sm font-semibold tracking-wide text-[#f97316]">
            Field inventory for contractors
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Know what is on the truck before the crew leaves the shop.
          </h1>
          <p className="max-w-xl text-lg text-white/70">
            Stockr is a company workspace for warehouses and service fleets. Scan barcodes,
            transfer material, receive POs, and invite your team — each company on its own plan.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {account ? (
              <Button asChild size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Link href="/dashboard">
                  Continue to {account.company.name}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  <Link href="/signup">
                    Create your company
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
                  <Link href="/login">Log in</Link>
                </Button>
              </>
            )}
          </div>
          <p className="text-sm text-white/50">
            Demo workspace: <span className="font-mono text-white/80">demo@stockr.app</span> /{" "}
            <span className="font-mono text-white/80">demo1234</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
            <Warehouse className="size-4 text-[#f97316]" />
            Summit Electric · Fleet plan
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["On hand", "4,234"],
              ["Trucks", "2"],
              ["Low stock", "3"],
              ["Open POs", "2"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#12203a] p-4">
                <p className="text-xs text-white/50">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-white/55">
            New companies start empty on Starter. The demo account is preloaded so you can click
            around before you import your own catalog.
          </p>
        </div>
      </section>

      <section id="product" className="border-t border-white/10 bg-[#111827] py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <feature.icon className="mb-3 size-6 text-[#f97316]" />
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-extrabold">Plans that match a shop, not a spreadsheet.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-white/65">
          Start free. Upgrade when you add trucks or seats. Billing here is a local checkout so you
          can try upgrades without a Stripe key.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.id === "pro"
                  ? "border-[#f97316] bg-[#f97316]/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <p className="text-sm font-semibold text-[#f97316]">{plan.name}</p>
              <p className="mt-2 text-4xl font-extrabold">
                ${plan.monthlyPrice}
                <span className="text-base font-medium text-white/50">/mo</span>
              </p>
              <p className="mt-2 text-sm text-white/60">{plan.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-white/80">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#f97316]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Link href={account ? "/billing" : "/signup"}>{account ? "Manage plan" : "Get started"}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/40">
        Stockr · stockr.currentflowconsulting.org · Company workspaces for contractor inventory
      </footer>
    </div>
  );
}
