import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { BarChart3, Download, Warehouse, Truck, FolderKanban, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";

function exportCSV(filename, headers, rows) {
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 90), "yyyy-MM-dd"));
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Material.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Location.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventoryItems", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.InventoryItem.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Transaction.filter({ company_id: activeCompanyId }, "-created_date", 1000) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const getMat = (id) => materials.find(m => m.id === id);
  const getLoc = (id) => locations.find(l => l.id === id);

  // ── Inventory Valuation by Location ──
  const valuation = useMemo(() => {
    return locations.map(loc => {
      const items = inventoryItems.filter(i => i.location_id === loc.id && (i.quantity || 0) > 0);
      const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0);
      const totalValue = items.reduce((s, i) => {
        const mat = getMat(i.material_id);
        return s + (i.quantity || 0) * (mat?.unit_cost || 0);
      }, 0);
      return { location: loc.name, type: loc.type, totalQty, totalValue };
    }).filter(v => v.totalQty > 0);
  }, [locations, inventoryItems, materials]);

  const totalValuation = valuation.reduce((s, v) => s + v.totalValue, 0);

  // ── Usage by Project (date-filtered) ──
  const fromTs = fromDate ? new Date(fromDate + "T00:00:00") : null;
  const toTs = toDate ? new Date(toDate + "T23:59:59") : null;

  const usageByProject = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.type === "use")
      .filter(t => !fromTs || new Date(t.created_date) >= fromTs)
      .filter(t => !toTs || new Date(t.created_date) <= toTs)
      .forEach(t => {
        const key = t.project_name || (t.buildr_project_id ? `Buildr:${t.buildr_project_id.slice(-6)}` : "Unassigned");
        if (!map[key]) map[key] = { project: key, totalQty: 0, totalValue: 0, count: 0 };
        const mat = getMat(t.material_id);
        map[key].totalQty += (t.quantity || 0);
        map[key].totalValue += (t.quantity || 0) * (mat?.unit_cost || 0);
        map[key].count += 1;
      });
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [transactions, materials, fromTs, toTs]);

  // ── Shrinkage Report (date-filtered) ──
  const shrinkage = useMemo(() => {
    const map = {};
    transactions
      .filter(t => t.type === "shrink")
      .filter(t => !fromTs || new Date(t.created_date) >= fromTs)
      .filter(t => !toTs || new Date(t.created_date) <= toTs)
      .forEach(t => {
        const mat = getMat(t.material_id);
        const key = mat?.name || "Unknown";
        if (!map[key]) map[key] = { material: key, totalQty: 0, totalValue: 0, count: 0 };
        map[key].totalQty += (t.quantity || 0);
        map[key].totalValue += (t.quantity || 0) * (mat?.unit_cost || 0);
        map[key].count += 1;
      });
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [transactions, materials, fromTs, toTs]);

  const totalShrinkage = shrinkage.reduce((s, r) => s + r.totalValue, 0);
  const totalUsage = usageByProject.reduce((s, r) => s + r.totalValue, 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const reportsContent = (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-secondary" />
          Reports
        </h1>
        <p className="text-muted-foreground mt-1">Valuation, usage, and shrinkage — export to CSV</p>
      </div>

      {/* Date range filter (applies to Usage + Shrinkage) */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Valuation by Location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-secondary" />
            Inventory Valuation by Location
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => exportCSV("valuation-by-location.csv", ["Location", "Type", "Total Qty", "Total Value"], valuation.map(v => [v.location, v.type, v.totalQty, v.totalValue.toFixed(2)]))}>
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {valuation.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory on hand.</p>
          ) : (
            <div className="space-y-2">
              {valuation.map(v => (
                <div key={v.location} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    {v.type === "warehouse" ? <Warehouse className="w-4 h-4 text-primary" /> : <Truck className="w-4 h-4 text-secondary" />}
                    <span className="text-sm font-medium truncate">{v.location}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">${v.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground">{v.totalQty} units</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                <span className="text-sm font-bold">Total Valuation</span>
                <span className="text-lg font-bold text-secondary">${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage by Project */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-secondary" />
            Usage by Project
            <span className="text-xs text-muted-foreground font-normal ml-1">({format(fromTs || new Date(), "MMM d")} – {format(toTs || new Date(), "MMM d")})</span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => exportCSV("usage-by-project.csv", ["Project", "Transactions", "Total Qty", "Total Value"], usageByProject.map(r => [r.project, r.count, r.totalQty, r.totalValue.toFixed(2)]))}>
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usageByProject.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage in this period.</p>
          ) : (
            <div className="space-y-2">
              {usageByProject.map(r => (
                <div key={r.project} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.project}</p>
                    <p className="text-xs text-muted-foreground">{r.count} transaction{r.count !== 1 ? "s" : ""} · {r.totalQty} units</p>
                  </div>
                  <p className="text-sm font-semibold flex-shrink-0">${r.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/10 border border-secondary/20">
                <span className="text-sm font-bold">Total Usage</span>
                <span className="text-lg font-bold text-secondary">${totalUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shrinkage Report */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Shrinkage Report
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => exportCSV("shrinkage.csv", ["Material", "Events", "Total Qty", "Total Value"], shrinkage.map(r => [r.material, r.count, r.totalQty, r.totalValue.toFixed(2)]))}>
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shrinkage.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shrinkage recorded in this period.</p>
          ) : (
            <div className="space-y-2">
              {shrinkage.map(r => (
                <div key={r.material} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.material}</p>
                    <p className="text-xs text-muted-foreground">{r.count} event{r.count !== 1 ? "s" : ""} · {r.totalQty} units lost</p>
                  </div>
                  <p className="text-sm font-semibold text-red-600 flex-shrink-0">-${r.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200">
                <span className="text-sm font-bold text-red-700">Total Shrinkage</span>
                <span className="text-lg font-bold text-red-600">-${totalShrinkage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (!user) return null;
  return <CompanyAccessGate userEmail={user.email}>{reportsContent}</CompanyAccessGate>;
}