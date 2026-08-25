"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Package,
  RefreshCw,
  ScanLine,
  Settings,
  ShoppingCart,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/locations", label: "Locations", icon: MapPin },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/activity", label: "Activity Log", icon: ClipboardList },
  { href: "/catalog", label: "Catalog", icon: Package },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/scanner", label: "Scanner", icon: ScanLine },
  { href: "/inventory", label: "Inventory", icon: Warehouse },
  { href: "/transfers", label: "Activity", icon: ArrowLeftRight },
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
  const { hydrated } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const hideMobileNav = !MOBILE_NAV.some((item) => item.href === pathname);

  const refresh = () => {
    setRefreshing(true);
    window.location.reload();
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
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={pathname === item.href}
            />
          ))}
        </nav>
        <div
          className="px-3 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Sync now
          </button>
        </div>
      </aside>

      <div
        className="fixed top-0 right-0 left-0 z-40 flex h-14 items-center justify-between px-4 shadow-lg lg:hidden"
        style={{ background: SIDEBAR }}
      >
        <Brand compact />
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="p-1.5"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <RefreshCw className={cn("size-[18px]", refreshing && "animate-spin")} />
        </button>
      </div>

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
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px]"
              style={{ color: active ? "#fff" : "rgba(255,255,255,0.55)" }}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main
        className={cn(
          "min-h-screen lg:ml-64",
          "px-4 py-5 lg:p-8",
          "mt-14 lg:mt-0",
          hideMobileNav ? "pb-6" : "pb-24 lg:pb-8",
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
