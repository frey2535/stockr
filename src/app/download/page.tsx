import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Check, Download, Globe, Smartphone } from "lucide-react";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { getCurrentAccount } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import {
  ANDROID_APK_PATH,
  ANDROID_PACKAGE_NAME,
  PLAY_STORE_URL,
} from "@/lib/site";

function apkOnDisk() {
  return existsSync(path.join(process.cwd(), "public", "downloads", "stockr.apk"));
}

export default async function DownloadPage() {
  const account = await getCurrentAccount();
  const hasApk = apkOnDisk();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <MarketingHeader signedIn={Boolean(account)} />

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-sm font-semibold tracking-wide text-[#f97316]">Get Stockr</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
          Sell and run inventory on the phone, without living inside Google Play.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-white/70">
          Companies subscribe on this site. The Android app is a wrapper around the same
          workspace, so a crew can install from Play or sideload the APK and still pay you
          here — not through a store cut.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 lg:grid-cols-3">
        <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
          <Globe className="size-8 text-[#f97316]" />
          <h2 className="mt-4 text-xl font-semibold">Use it in the browser</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-white/65">
            Best for the office. Create the company, pick a plan, and invite the crew. Camera
            scan works on HTTPS phones that support BarcodeDetector.
          </p>
          <Button asChild className="mt-6 bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Link href={account ? "/dashboard" : "/signup"}>
              {account ? "Open workspace" : "Start free on the web"}
            </Link>
          </Button>
        </article>

        <article className="flex flex-col rounded-2xl border border-[#f97316] bg-[#f97316]/10 p-6">
          <Download className="size-8 text-[#f97316]" />
          <h2 className="mt-4 text-xl font-semibold">Android APK (sideload)</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-white/65">
            Install beside Play, or on devices that never open the store. Package{" "}
            <span className="font-mono text-white">{ANDROID_PACKAGE_NAME}</span>. Allow
            installs from this browser, then open the file.
          </p>
          {hasApk ? (
            <Button asChild className="mt-6 bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <a href={ANDROID_APK_PATH} download="stockr.apk">
                Download Stockr APK
              </a>
            </Button>
          ) : (
            <p className="mt-6 rounded-lg border border-white/15 bg-black/20 p-3 text-sm text-white/70">
              The release APK is built with <span className="font-mono">npm run android:apk</span>{" "}
              and published at <span className="font-mono">{ANDROID_APK_PATH}</span>.
            </p>
          )}
        </article>

        <article className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
          <Smartphone className="size-8 text-[#f97316]" />
          <h2 className="mt-4 text-xl font-semibold">Google Play</h2>
          <p className="mt-2 flex-1 text-sm leading-6 text-white/65">
            Same package name. Upload the AAB from{" "}
            <span className="font-mono">npm run android:bundle</span> in Play Console. People
            who prefer the store can install from there.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-6 border-white/20 bg-transparent text-white hover:bg-white/10"
          >
            <a href={PLAY_STORE_URL} rel="noreferrer">
              Open Play listing
            </a>
          </Button>
        </article>
      </section>

      <section id="pricing" className="border-t border-white/10 bg-[#111827] py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold">Sell the subscription here</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-white/65">
            Play can distribute the app. Plans stay on Stockr so you can invoice, trial, and
            upgrade without a store account. Checkout is mocked until Stripe is connected.
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
                  <Link href={account ? "/billing" : "/signup"}>
                    {account ? "Manage plan" : "Subscribe"}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
