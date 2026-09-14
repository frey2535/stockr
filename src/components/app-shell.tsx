"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  ScanLine,
  Settings,
  ShoppingCart,
  Shield,
  Warehouse,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getPlan } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { prefetchTab } from "@/lib/tab-prefetch";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/activity", label: "Activity Log", icon: ClipboardList },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/activity", label: "Activity", icon: ClipboardList },
];

const SIDEBAR = "#0d1117";
const ACTIVE = "#2563eb";
const ORANGE = "#f97316";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Stockr"
        width={compact ? 28 : 36}
        height={compact ? 28 : 36}
        className="rounded-md object-cover"
        style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}
      />
      <div>
        <div
          style={{
            fontWeight: 800,
            fontSize: compact ? 15 : 16,
            color: "#fff",
            letterSpacing: 1,
          }}
        >
          STOCK<span style={{ color: ORANGE }}>R</span>
        </div>
        {!compact ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            Inventory Mgmt
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        color: active ? "#fff" : "rgba(255,255,255,0.65)",
        background: active ? ACTIVE : "transparent",
        textDecoration: "none",
      }}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hydrated, account, logout } = useStore();
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
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col lg:flex"
        style={{
          background: SIDEBAR,
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <Brand />
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href}
            />
          ))}
        </nav>
        <div
          className="space-y-2 px-3 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          {account ? (
            <div className="px-3 py-1">
              <p className="truncate text-xs font-medium text-white">{account.company.name}</p>
              <p className="truncate text-[11px] text-white/45">{account.user.email}</p>
              {plan ? (
                <Link
                  href="/billing"
                  className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: ORANGE, color: "#fff" }}
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <LogOut className="size-4" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div
        className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between px-4 shadow-lg lg:hidden"
        style={{ background: SIDEBAR }}
      >
        <Brand compact />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="p-1.5"
            style={{ color: moreOpen || moreActive ? "#fff" : "rgba(255,255,255,0.6)" }}
            aria-expanded={moreOpen}
            aria-label={moreOpen ? "Close menu" : "Open menu"}
          >
            {moreOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="p-1.5"
            style={{ color: "rgba(255,255,255,0.6)" }}
            aria-label="Sign out"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
      </div>

      {moreOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute right-0 bottom-0 left-0 rounded-t-2xl px-3 pt-3"
            style={{
              background: SIDEBAR,
              paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wide text-white/40 uppercase">
              More
            </p>
            <div className="grid grid-cols-2 gap-2">
              {moreNav.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    onPointerEnter={() => prefetchTab(item.href)}
                    className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium"
                    style={{
                      color: active ? "#fff" : "rgba(255,255,255,0.75)",
                      background: active ? ACTIVE : "rgba(255,255,255,0.06)",
                    }}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        className="fixed right-0 bottom-0 left-0 z-40 flex lg:hidden"
        style={{
          background: SIDEBAR,
          borderTop: "1px solid rgba(255,255,255,0.1)",
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
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px]"
              style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px]"
          style={{ color: moreOpen || moreActive ? "#fff" : "rgba(255,255,255,0.55)" }}
          aria-expanded={moreOpen}
        >
          <Menu className="size-4" />
          More
        </button>
      </nav>

      <main
        className={cn(
          "min-h-screen lg:ml-64",
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
