"use client";

import Link from "next/link";
import { AlertTriangle, MapPin, Package, ScanLine, ShieldCheck, Truck, Wallet, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ActivityItem } from "@/components/activity-item";
import { StockStatusBadge } from "@/components/stock-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RestockBoard } from "@/components/restock-board";
import { useStore } from "@/lib/store";
import { useApi } from "@/lib/use-api";
import { money, qty, relativeTime } from "@/lib/format";
import type { DashboardPayload } from "@/lib/workspace-types";

function sameDay(iso: string) {
  const a = new Date(iso);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DashboardPage() {
  const { workspace, account } = useStore();
  const { settings, locations } = workspace;
  const { data, loading, reload } = useApi<DashboardPayload>("/api/dashboard");

  const alerts = data?.alerts || [];
  const restock = data?.restock || [];
  const criticalCount = alerts.filter((row) => row.status === "critical").length;
  const vansToRestock = new Set(restock.map((row) => row.locationId)).size;
  const lastMove = data?.recent[0];
  const todayMoves = (data?.recent || []).filter((tx) => sameDay(tx.created_at)).length;
  const health =
    criticalCount > 0 || vansToRestock > 2 ? "action" : restock.length > 0 || alerts.length > 0 ? "watch" : "ok";
  const shopEmpty = locations.length === 0 && (data?.materialCount || 0) === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title={settings.company_name || account?.company.name || "Command"}
        description="On-hand value, van coverage, and the SKUs that will stop a job if you ignore them."
        actions={
          <>
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt="Company Logo"
                className="h-14 w-auto max-w-[200px] object-contain"
              />
            ) : null}
            <Button asChild>
              <Link href="/scanner">
                <ScanLine className="mr-2 size-4" />
                Scan to job
              </Link>
            </Button>
          </>
        }
      />

      {shopEmpty ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Stand up the shop</p>
              <p className="text-sm text-muted-foreground">
                Add a warehouse or truck, then load the catalog. Starter includes 2 locations and 50 SKUs.
              </p>
            </div>
            <Button asChild>
              <Link href="/locations">Add a location</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card
          className={
            health === "action"
              ? "border-red-500/30 bg-red-500/5"
              : health === "watch"
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-emerald-500/30 bg-emerald-500/5"
          }
        >
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={
                  health === "action"
                    ? "flex size-10 items-center justify-center rounded-xl bg-red-600/15 text-red-700 dark:text-red-400"
                    : health === "watch"
                      ? "flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-400"
                      : "flex size-10 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                }
              >
                {health === "ok" ? <ShieldCheck className="size-5" /> : <AlertTriangle className="size-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {loading
                    ? "Reading live stock…"
                    : health === "action"
                      ? "Action required"
                      : health === "watch"
                        ? "Watch list"
                        : "Fleet is covered"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {loading
                    ? "Pulling vans, SKUs, and last movement."
                    : [
                        criticalCount ? `${criticalCount} SKU${criticalCount === 1 ? "" : "s"} at critical` : null,
                        vansToRestock ? `${vansToRestock} van${vansToRestock === 1 ? "" : "s"} below min` : null,
                        !criticalCount && !vansToRestock ? "Every tracked van is at or above min" : null,
                        lastMove ? `Last move ${relativeTime(lastMove.created_at)}` : "No movements yet",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/restock">Replenish</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/inventory?stock=low">Open exceptions</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="On-hand value"
          value={loading ? "…" : `$${money(data?.value || 0)}`}
          subtitle={`${qty(data?.totalItems || 0)} units in the field`}
          icon={<Wallet className="size-4" />}
          accent
        />
        <StatCard
          title="SKUs at risk"
          value={loading ? "…" : alerts.length}
          subtitle={criticalCount ? `${criticalCount} critical` : "At or below policy"}
          icon={<AlertTriangle className="size-4" />}
          tone={criticalCount ? "action" : alerts.length ? "watch" : "ok"}
        />
        <StatCard
          title="Vans to restock"
          value={loading ? "…" : vansToRestock}
          subtitle={`${data?.vehicles || 0} vehicles · ${data?.warehouses || 0} warehouses`}
          icon={<Truck className="size-4" />}
          tone={vansToRestock ? "watch" : "ok"}
        />
        <StatCard
          title="Catalog"
          value={loading ? "…" : data?.materialCount || 0}
          subtitle={todayMoves ? `${todayMoves} moves today` : "Unique materials"}
          icon={<Package className="size-4" />}
        />
      </div>

      {restock.length > 0 ? <RestockBoard rows={restock} compact onDone={reload} /> : null}

      {alerts.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              Exceptions
              <Badge variant="secondary">{alerts.length}</Badge>
              {criticalCount > 0 ? (
                <Badge className="border-transparent bg-red-600/15 text-red-700 dark:text-red-400">
                  {criticalCount} critical
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((item) => (
              <Link
                key={item.id}
                href={`/inventory?q=${encodeURIComponent(item.name)}`}
                className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-muted/30 p-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    On hand {qty(item.totalQty)} {item.unit || "units"}
                    {item.reorder_point != null ? ` · reorder ${item.reorder_point}` : ""}
                    {item.min_stock_level != null ? ` · min ${item.min_stock_level}` : ""}
                  </p>
                </div>
                <StockStatusBadge status={item.status === "critical" ? "critical" : "low"} />
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="size-5 text-primary" />
              Location health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data?.locations.length ? (
              <p className="text-sm text-muted-foreground">No warehouses or trucks yet.</p>
            ) : (
              data.locations.map((location) => {
                const locationRestock = restock.filter((row) => row.locationId === location.id).length;
                return (
                  <Link
                    key={location.id}
                    href={`/inventory?location=${encodeURIComponent(location.id)}`}
                    className="flex items-center justify-between rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted/70"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        {location.type === "warehouse" ? (
                          <Warehouse className="size-4 text-primary" />
                        ) : (
                          <Truck className="size-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {location.materialCount} SKUs
                          {locationRestock ? ` · ${locationRestock} below min` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{qty(location.units)}</span>
                      {locationRestock ? (
                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Restock</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Covered</p>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href="/locations">Manage locations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Live activity</CardTitle>
              {(data?.recent.length || 0) > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/activity">Ledger</Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!data?.recent.length ? (
              <p className="text-sm text-muted-foreground">
                No movements yet. Scan a barcode onto a job to open the ledger.
              </p>
            ) : (
              <div className="space-y-3">
                {data.recent.map((tx) => (
                  <ActivityItem
                    key={tx.id}
                    tx={tx}
                    materials={data.recentMaterials}
                    locations={data.locations}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
