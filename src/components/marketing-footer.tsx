import Link from "next/link";
import { SITE_HOST } from "@/lib/site";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p>Stockr · {SITE_HOST} · Company workspaces for contractor inventory</p>
        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/download" className="hover:text-foreground">
            Get the app
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
