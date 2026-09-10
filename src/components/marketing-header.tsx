"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1117]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Stockr" className="size-8 rounded-md object-cover" />
          <span className="text-base font-extrabold tracking-wide text-white">
            STOCK<span className="text-[#f97316]">R</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
          <a href="/#product" className="hover:text-white">
            Product
          </a>
          <a href="/#pricing" className="hover:text-white">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Link href="/dashboard">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Link href="/signup">Start free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
