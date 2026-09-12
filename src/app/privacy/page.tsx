import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { getCurrentAccount } from "@/lib/auth";
import { LEGAL_ENTITY, SITE_HOST, SUPPORT_EMAIL } from "@/lib/site";

export default async function PrivacyPage() {
  const account = await getCurrentAccount();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      <MarketingHeader signedIn={Boolean(account)} />
      <article className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-white/75">
        <h1 className="text-4xl font-extrabold text-white">Privacy policy</h1>
        <p className="text-sm text-white/50">Last updated September 12, 2026</p>
        <p>
          {LEGAL_ENTITY} (“we”) operates Stockr at {SITE_HOST} and the Android app with package
          name org.currentflowconsulting.stockr. This policy covers company workspaces created
          on Stockr, including installs from Google Play and sideloaded APKs.
        </p>
        <h2 className="text-xl font-semibold text-white">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Account name, email, and password hash for sign-in.</li>
          <li>Company name, plan, invite codes, and team membership.</li>
          <li>
            Inventory you enter: locations, catalog items, barcodes, quantities, purchase
            orders, transfers, and activity history.
          </li>
          <li>Session cookies so you stay signed in on this host.</li>
        </ul>
        <h2 className="text-xl font-semibold text-white">Camera</h2>
        <p>
          The scanner can use the device camera to read barcodes. Frames are processed on the
          device. We do not upload photos or video from the camera.
        </p>
        <h2 className="text-xl font-semibold text-white">Where data lives</h2>
        <p>
          Production workspaces are stored in Supabase (Postgres) in tables prefixed{" "}
          <span className="font-mono text-white/90">stockr_</span>. Local preview without those
          keys can use a file on the server. We do not sell your inventory or contact list.
        </p>
        <h2 className="text-xl font-semibold text-white">Cookies</h2>
        <p>
          Stockr sets an httpOnly session cookie named stockr_session. It is not used for
          advertising. Clearing cookies signs you out.
        </p>
        <h2 className="text-xl font-semibold text-white">Your choices</h2>
        <p>
          Workspace owners can invite or remove teammates and close the account by contacting
          us. Ask us to export or delete a company workspace at {SUPPORT_EMAIL}.
        </p>
        <h2 className="text-xl font-semibold text-white">Contact</h2>
        <p>
          {LEGAL_ENTITY} · {SUPPORT_EMAIL}
        </p>
      </article>
      <MarketingFooter />
    </div>
  );
}
