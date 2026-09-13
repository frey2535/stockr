"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, Wallet, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { downloadCsv } from "@/lib/inventory";
import { money, qty } from "@/lib/format";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { state } = useStore();
  const { locations, materials, inventory, transactions } = state;
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(daysAgo(0));

  const valuation = useMemo(() => {
    return locations.map((location) => {
      const rows = inventory.filter((row) => row.location_id === location.id && row.quantity > 0);
      const totalQty = rows.reduce((sum, row) => sum + row.quantity, 0);
      const totalValue = rows.reduce((sum, row) => {
        const material = materials.find((item) => item.id === row.material_id);
        return sum + row.quantity * (material?.unit_cost || 0);
      }, 0);
      return { location: location.name, type: location.type, totalQty, totalValue };
    });
  }, [locations, inventory, materials]);

  const grand = valuation.reduce((sum, row) => sum + row.totalValue, 0);

  const inRange = useMemo(() => {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(`${to}T23:59:59`) : null;
    return transactions.filter((tx) => {
      const t = new Date(tx.created_at).getTime();
      if (start && t < start.getTime()) return false;
      if (end && t > end.getTime()) return false;
      return true;
    });
  }, [transactions, from, to]);

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(`${to}T23:59:59`) : null;

  const usage = useMemo(() => {
    const map = new Map<string, { qty: number; value: number }>();
    for (const tx of inRange.filter((row) => row.type === "use")) {
      const key = tx.project || "Unassigned";
      const material = materials.find((item) => item.id === tx.material_id);
      const current = map.get(key) || { qty: 0, value: 0 };
      current.qty += tx.quantity;
      current.value += tx.quantity * (material?.unit_cost || 0);
      map.set(key, current);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value);
  }, [inRange, materials]);

  const shrinkage = inRange.filter((tx) => tx.type === "shrink");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Valuation, usage, and shrinkage — export to CSV"
        icon={<BarChart3 className="size-7 text-secondary" />}
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
            </div>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="size-5 text-secondary" />
            Inventory Valuation by Location
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() =>
                downloadCsv(
                  "valuation-by-location.csv",
                  ["Location", "Type", "Total Qty", "Total Value"],
                  valuation.map((row) => [row.location, row.type, row.totalQty, row.totalValue.toFixed(2)]),
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {valuation.every((row) => row.totalQty === 0) ? (
            <p className="text-sm text-muted-foreground">No inventory on hand.</p>
          ) : (
            <div className="space-y-2">
              {valuation.map((row) => (
                <div key={row.location} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">{row.location}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {row.type} · {qty(row.totalQty)} units
                    </p>
                  </div>
                  <p className="font-semibold">${money(row.totalValue)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-secondary/20 bg-secondary/5 p-3">
                <span className="text-sm font-bold">Total Valuation</span>
                <span className="text-lg font-bold text-secondary">${money(grand)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="size-5 text-secondary" />
            Usage by Project
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({fromDate?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
              {toDate?.toLocaleDateString(undefined, { month: "short", day: "numeric" })})
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() =>
                downloadCsv(
                  "usage-by-project.csv",
                  ["Project", "Qty Used", "Estimated Value"],
                  usage.map(([name, row]) => [name, row.qty, row.value.toFixed(2)]),
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage in this date range.</p>
          ) : (
            <div className="space-y-2">
              {usage.map(([name, row]) => (
                <div key={name} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{qty(row.qty)} units used</p>
                  </div>
                  <p className="font-semibold">${money(row.value)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            Shrinkage
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() =>
                downloadCsv(
                  "shrinkage.csv",
                  ["When", "Material", "Qty", "Location", "Notes"],
                  shrinkage.map((tx) => [
                    tx.created_at,
                    materials.find((row) => row.id === tx.material_id)?.name || "",
                    tx.quantity,
                    locations.find((row) => row.id === tx.from_location_id)?.name || "",
                    tx.notes || "",
                  ]),
                )
              }
            >
              <Download className="mr-1 size-3.5" />
              CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shrinkage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shrinkage recorded in this date range.</p>
          ) : (
            <div className="space-y-2">
              {shrinkage.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-xl bg-red-50 p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {materials.find((row) => row.id === tx.material_id)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {locations.find((row) => row.id === tx.from_location_id)?.name} · {tx.notes}
                    </p>
                  </div>
                  <p className="font-semibold text-red-700">-{qty(tx.quantity)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
