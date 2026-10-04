"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function MarketingHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-4"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Link href="/" className="min-w-0 shrink">
          <BrandMark compact subtitle="" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/#product" className="hover:text-foreground">
            Product
          </Link>
          <Link href="/#pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/download" className="hover:text-foreground">
            Get the app
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="px-2">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Start free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
