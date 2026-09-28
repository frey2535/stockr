import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { getCurrentAccount } from "@/lib/auth";
import { LEGAL_ENTITY, SITE_HOST, SUPPORT_EMAIL } from "@/lib/site";

export default async function TermsPage() {
  const account = await getCurrentAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader signedIn={Boolean(account)} />
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-muted-foreground">
        <h1 className="text-4xl font-extrabold text-foreground">Terms of use</h1>
        <p className="text-sm text-muted-foreground">Last updated September 28, 2026</p>
        <p>
          These terms cover the Stockr website at {SITE_HOST} and the Android app
          (org.currentflowconsulting.stockr), whether you install it from Google Play or from
          the APK on this site.
        </p>
        <h2 className="text-xl font-semibold text-foreground">The product</h2>
        <p>
          Stockr is field inventory software for a company workspace. You are responsible for
          the accuracy of counts, barcodes, and who you invite.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Plans and payment</h2>
        <p>
          Starter is free with limits. Pro and Fleet are paid monthly. On the website and PWA,
          {LEGAL_ENTITY} charges through Stripe. In the Google Play Android app, paid plans are
          purchased with Google Play Billing. Fees are due until you cancel from Billing (Stripe
          portal on the web, or Google Play subscriptions on Android). Refunds follow the
          processor you paid: Stripe for web, Google Play for the store app. Switching to
          Starter in the app does not by itself cancel a Stripe or Play subscription — cancel
          there too.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Acceptable use</h2>
        <p>
          Do not use Stockr to store illegal goods data, attack the service, or access another
          company’s workspace. We may suspend an account that threatens other tenants or the
          host.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Accounts</h2>
        <p>
          You must keep your password confidential. Owners can export or delete a workspace from
          Settings. Contact {SUPPORT_EMAIL} for help.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Sideloading</h2>
        <p>
          The APK on this site is the same package as Play. Sideloaded installs still use the
          same workspace. Digital subscriptions bought in the Play app stay on Play; web
          subscriptions stay on Stripe.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Contact</h2>
        <p>
          {LEGAL_ENTITY} · {SUPPORT_EMAIL}
        </p>
      </article>
      <MarketingFooter />
    </div>
  );
}
