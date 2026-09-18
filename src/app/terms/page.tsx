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
        <p className="text-sm text-muted-foreground">Last updated September 12, 2026</p>
        <p>
          These terms cover the Stockr website at {SITE_HOST} and the Android app
          (org.currentflowconsulting.stockr), whether you install it from Google Play or from
          the APK on this site.
        </p>
        <h2 className="text-xl font-semibold text-foreground">The product</h2>
        <p>
          Stockr is field inventory software for a company workspace. You are responsible for
          the accuracy of counts, barcodes, and who you invite. Demo data on demo@stockr.app
          is sample material, not a customer catalog.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Plans and payment</h2>
        <p>
          Starter is free with limits. Pro and Fleet are billed by {LEGAL_ENTITY} on this
          website, not as a Google Play in-app purchase. Until card charging is connected,
          choosing a paid plan in the app activates that plan for testing only and does not
          charge a card. When live billing is on, fees are due monthly unless cancelled from
          Billing.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Acceptable use</h2>
        <p>
          Do not use Stockr to store illegal goods data, attack the service, or access another
          company’s workspace. We may suspend an account that threatens other tenants or the
          host.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Sideloading</h2>
        <p>
          The APK is the same application ID as the Play build. Installing unknown sources is
          your device setting. Keep the APK you download; we are not responsible for copies
          obtained from other websites.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Disclaimer</h2>
        <p>
          Stockr is provided as-is for operational inventory. It is not a certified accounting
          system. {LEGAL_ENTITY} is not liable for stockouts, job delays, or lost material
          that result from counts entered in the workspace.
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
