"use client";

import Link from "next/link";
import { MapPin, Package, ScanLine, Truck, Wallet, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ActivityItem } from "@/components/activity-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RestockBoard } from "@/components/restock-board";
import { useStore } from "@/lib/store";
import { useApi } from "@/lib/use-api";
import { money, qty } from "@/lib/format";
import type { DashboardPayload } from "@/lib/workspace-types";

export default function DashboardPage() {
  const { workspace } = useStore();
  const { settings, locations } = workspace;
  const { data, loading, reload } = useApi<DashboardPayload>("/api/dashboard");

  const alerts = data?.alerts || [];
  const criticalCount = alerts.filter((row) => row.status === "critical").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your inventory at a glance"
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
                Scan Material
              </Link>
            </Button>
          </>
        }
      />

      {locations.length === 0 && (data?.materialCount || 0) === 0 ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Your shop is empty</p>
              <p className="text-sm text-muted-foreground">
                Add a warehouse or truck, then put materials in the catalog. Starter includes 2
                locations and 50 items.
              </p>
            </div>
            <Button asChild>
              <Link href="/locations">Add a location</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Items" value={loading ? "…" : qty(data?.totalItems || 0)} icon={<Warehouse className="size-4" />} />
        <StatCard
          title="Estimated Total Value"
          value={loading ? "…" : `$${money(data?.value || 0)}`}
          icon={<Wallet className="size-4" />}
          accent
        />
        <StatCard
          title="Vehicles"
          value={loading ? "…" : data?.vehicles || 0}
          subtitle={`${data?.warehouses || 0} warehouse(s)`}
          icon={<Truck className="size-4" />}
        />
        <StatCard
          title="Materials"
          value={loading ? "…" : data?.materialCount || 0}
          subtitle="unique items"
          icon={<Package className="size-4" />}
          accent
        />
      </div>

      {(data?.restock || []).length > 0 ? (
        <RestockBoard rows={data?.restock || []} compact onDone={reload} />
      ) : null}

      {alerts.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              Low Stock Alerts
              <Badge variant="secondary">{alerts.length}</Badge>
              {criticalCount > 0 ? (
                <Badge className="bg-red-100 text-red-700">{criticalCount} critical</Badge>
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
                    On hand: {qty(item.totalQty)} {item.unit || "units"}
                    {item.reorder_point != null ? ` · Reorder at: ${item.reorder_point}` : ""}
                  </p>
                </div>
                <Badge
                  className={
                    item.status === "critical"
                      ? "shrink-0 bg-red-100 text-red-700"
                      : "shrink-0 bg-orange-100 text-orange-700"
                  }
                >
                  {item.status === "critical" ? "Critical" : "Reorder"}
                </Badge>
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
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data?.locations.length ? (
              <p className="text-sm text-muted-foreground">
                No locations yet. Add a warehouse or vehicle to get started.
              </p>
            ) : (
              data.locations.map((location) => (
                <Link
                  key={location.id}
                  href={`/inventory?location=${encodeURIComponent(location.id)}`}
                  className="flex items-center justify-between rounded-xl bg-muted/50 p-3 transition-colors hover:bg-muted/70"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        location.type === "warehouse"
                          ? "flex size-9 items-center justify-center rounded-lg bg-primary/10"
                          : "flex size-9 items-center justify-center rounded-lg bg-primary/10"
                      }
                    >
                      {location.type === "warehouse" ? (
                        <Warehouse className="size-4 text-primary" />
                      ) : (
                        <Truck className="size-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{location.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {location.materialCount} materials
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{qty(location.units)}</span>
                </Link>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="mt-2 w-full">
              <Link href="/locations">Manage Locations</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                Recent Activity
              </CardTitle>
              {(data?.recent.length || 0) > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/activity">View all</Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!data?.recent.length ? (
              <p className="text-sm text-muted-foreground">
                No activity yet. Scan some materials to get started!
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
