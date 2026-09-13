import Link from "next/link";
import { SITE_HOST } from "@/lib/site";

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 py-8 text-sm text-white/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>Stockr · {SITE_HOST} · Company workspaces for contractor inventory</p>
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/download" className="hover:text-white">
            Get the app
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
