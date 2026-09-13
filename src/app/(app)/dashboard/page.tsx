"use client";

import Link from "next/link";
import { MapPin, Package, ScanLine, Truck, Wallet, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ActivityItem } from "@/components/activity-item";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { money, qty } from "@/lib/format";
import { totalValue } from "@/lib/inventory";

export default function DashboardPage() {
  const { state } = useStore();
  const { settings, locations, materials, inventory, transactions } = state;

  const totalItems = inventory.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const value = totalValue(state);
  const vehicles = locations.filter((row) => row.type === "vehicle").length;
  const warehouses = locations.filter((row) => row.type === "warehouse").length;

  const alerts = materials
    .map((material) => {
      const totalQty = inventory
        .filter((row) => row.material_id === material.id)
        .reduce((sum, row) => sum + row.quantity, 0);
      let status: "critical" | "reorder" | null = null;
      if (material.min_stock_level != null && totalQty <= material.min_stock_level) {
        status = "critical";
      } else if (material.reorder_point != null && totalQty <= material.reorder_point) {
        status = "reorder";
      }
      return { ...material, totalQty, status };
    })
    .filter((row) => row.status)
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "critical" ? -1 : 1));

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
            <Button asChild className="bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20 hover:bg-secondary/90">
              <Link href="/scanner">
                <ScanLine className="mr-2 size-4" />
                Scan Material
              </Link>
            </Button>
          </>
        }
      />

      {locations.length === 0 && materials.length === 0 ? (
        <Card className="border-secondary/40 bg-secondary/5">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Your shop is empty</p>
              <p className="text-sm text-muted-foreground">
                Add a warehouse or truck, then put materials in the catalog. Starter includes 2
                locations and 50 items.
              </p>
            </div>
            <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Link href="/locations">Add a location</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Items" value={qty(totalItems)} icon={<Warehouse className="size-4" />} />
        <StatCard
          title="Estimated Total Value"
          value={`$${money(value)}`}
          icon={<Wallet className="size-4" />}
          accent
        />
        <StatCard
          title="Vehicles"
          value={vehicles}
          subtitle={`${warehouses} warehouse(s)`}
          icon={<Truck className="size-4" />}
        />
        <StatCard
          title="Materials"
          value={materials.length}
          subtitle="unique items"
          icon={<Package className="size-4" />}
          accent
        />
      </div>

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
              <MapPin className="size-5 text-secondary" />
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No locations yet. Add a warehouse or vehicle to get started.
              </p>
            ) : (
              locations.map((location) => {
                const rows = inventory.filter(
                  (row) => row.location_id === location.id && row.quantity > 0,
                );
                const units = rows.reduce((sum, row) => sum + row.quantity, 0);
                return (
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
                            : "flex size-9 items-center justify-center rounded-lg bg-secondary/10"
                        }
                      >
                        {location.type === "warehouse" ? (
                          <Warehouse className="size-4 text-primary" />
                        ) : (
                          <Truck className="size-4 text-secondary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{location.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rows.length} materials
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{qty(units)}</span>
                  </Link>
                );
              })
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
              {transactions.length > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/activity">View all</Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity yet. Scan some materials to get started!
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((tx) => (
                  <ActivityItem
                    key={tx.id}
                    tx={tx}
                    materials={materials}
                    locations={locations}
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
