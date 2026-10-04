import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { getCurrentAccount } from "@/lib/auth";
import { LEGAL_ENTITY, SITE_HOST, SUPPORT_EMAIL } from "@/lib/site";

export default async function PrivacyPage() {
  const account = await getCurrentAccount();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader signedIn={Boolean(account)} />
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-muted-foreground">
        <h1 className="text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">Privacy policy</h1>
        <p className="text-sm text-muted-foreground">Last updated September 28, 2026</p>
        <p>
          {LEGAL_ENTITY} (“we”) operates Stockr at {SITE_HOST} and the Android app
          org.currentflowconsulting.stockr. This policy covers company workspaces created on
          Stockr, including installs from Google Play and sideloaded APKs.
        </p>
        <h2 className="text-xl font-semibold text-foreground">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account name, email, and password hash for sign-in.</li>
          <li>Company name, plan, invite codes, and team membership.</li>
          <li>
            Inventory you enter: locations, catalog items, barcodes, quantities, purchase
            orders, transfers, and activity history.
          </li>
          <li>Session cookies so you stay signed in on this host.</li>
          <li>Payment records from Stripe (web) or Google Play (Android app).</li>
        </ul>
        <h2 className="text-xl font-semibold text-foreground">Camera and photos</h2>
        <p>
          The scanner can use the camera to read barcodes on the device. When you use Photo ID,
          the still image is uploaded to Stockr’s servers so we can recognize the product and
          fill name, manufacturer, barcode, and part number. That image may be processed by
          Cloudflare Workers AI and, if configured, OpenAI or Google Gemini. We do not use
          photos for advertising. We do not keep the photo as catalog media unless you add the
          item and it has a public product image URL.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Voice</h2>
        <p>
          Optional voice commands use the browser or WebView speech service on the device. Audio
          is not stored by Stockr.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Where data lives</h2>
        <p>
          Production workspaces are stored in Supabase (Postgres) in tables prefixed{" "}
          <span className="font-mono text-foreground/90">stockr_</span>. Subprocessors include
          Cloudflare (hosting and vision), Supabase (database), Stripe (web checkout), Google
          Play (Android subscriptions), and optional OpenAI or Google for vision. We do not sell
          your inventory or contact list.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Cookies</h2>
        <p>
          Stockr sets an httpOnly session cookie named stockr_session. It is not used for
          advertising. Clearing cookies signs you out.
        </p>
        <h2 className="text-xl font-semibold text-foreground">Your choices</h2>
        <p>
          Workspace owners can export or delete the company from Settings → Your data. You can
          also email {SUPPORT_EMAIL}. Deletion removes the workspace, memberships, and inventory
          for that company. Password reset is available from the login page when email sending
          is configured; otherwise contact {SUPPORT_EMAIL}.
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
