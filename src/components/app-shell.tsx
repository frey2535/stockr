"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  PackageCheck,
  ScanLine,
  Settings,
  RefreshCw,
  ShoppingCart,
  Shield,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { getPlan } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { prefetchTab } from "@/lib/tab-prefetch";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";

const NAV = [
  { href: "/dashboard", label: "Ops", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/field-ops", label: "Material Control", icon: PackageCheck },
  { href: "/restock", label: "Restock", icon: RefreshCw },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/activity", label: "Activity Log", icon: ClipboardList },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/suppliers", label: "Suppliers", icon: Building2 },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { href: "/dashboard", label: "Ops", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/field-ops", label: "Control", icon: PackageCheck },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      onPointerEnter={() => prefetchTab(href)}
      onFocus={() => prefetchTab(href)}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated, account, logout, workspace } = useStore();
  const [signingOut, setSigningOut] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = account?.platformOwner
    ? [{ href: "/admin", label: "Platform", icon: Shield }, ...NAV]
    : NAV;
  const moreNav = nav.filter((item) => !MOBILE_NAV.some((tab) => tab.href === item.href));
  const moreActive = moreNav.some((item) => item.href === pathname);
  const plan = account ? getPlan(account.company.plan) : null;

  const signOut = async () => {
    setSigningOut(true);
    await logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center justify-between gap-3 border-b border-sidebar-border px-5 py-4">
          <BrandMark />
          <ThemeToggle />
        </div>
        <div className="border-b border-sidebar-border px-3 py-3">
          <div className="flex min-h-20 items-center justify-center overflow-hidden rounded-xl bg-muted/30 px-3 py-2">
            {workspace.settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workspace.settings.logo_url}
                alt={workspace.settings.company_name || "Company"}
                className="max-h-24 w-full max-w-[210px] object-contain"
              />
            ) : (
              <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-sidebar-border px-3 py-5 text-muted-foreground">
                <Building2 className="size-7" />
                <span className="truncate text-sm font-semibold">
                  {workspace.settings.company_name || "Company"}
                </span>
              </div>
            )}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href}
            />
          ))}
        </nav>
        <div className="space-y-2 border-t border-sidebar-border px-3 py-3">
          {account ? (
            <div>
              <WorkspaceSwitcher account={account} />
              {plan ? (
                <Link
                  href="/billing"
                  className="mt-2 ml-3 inline-flex rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold tracking-wide text-brand-foreground uppercase"
                >
                  {plan.name}
                </Link>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div
        className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 shadow-sm backdrop-blur-xl lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="min-w-0">
          <BrandMark compact />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-full p-2 text-muted-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/20"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute right-0 bottom-0 left-0 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-3 pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.12)]"
            style={{
              paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="mb-2 flex items-center justify-between px-3">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                More
              </p>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground"
                onClick={() => setMoreOpen(false)}
              >
                Close
              </button>
            </div>
            {account ? <WorkspaceSwitcher account={account} /> : null}
            <div className="grid grid-cols-1 gap-2">
              {moreNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    onPointerEnter={() => prefetchTab(item.href)}
                    className={cn(
                      "flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 leading-snug break-words">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed right-0 bottom-0 left-0 z-40 flex border-t border-border/60 bg-background/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              onPointerEnter={() => prefetchTab(item.href)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-center text-[10px] leading-tight font-semibold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-10 items-center justify-center rounded-full transition-all",
                  active && "bg-primary/15",
                )}
              >
                <Icon className={cn("size-4", active && "scale-110")} />
              </div>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-center text-[10px] leading-tight font-semibold",
            moreOpen || moreActive ? "text-primary" : "text-muted-foreground",
          )}
          aria-expanded={moreOpen}
        >
          <div
            className={cn(
              "flex h-6 w-10 items-center justify-center rounded-full",
              (moreOpen || moreActive) && "bg-primary/15",
            )}
          >
            <Menu className="size-4" />
          </div>
          More
        </button>
      </nav>

      <main
        className={cn(
          "min-h-screen overflow-x-clip lg:ml-64",
          "px-4 py-5 lg:p-8",
          "mt-14 lg:mt-0",
          "pb-24 lg:pb-8",
        )}
      >
        {!hydrated ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
