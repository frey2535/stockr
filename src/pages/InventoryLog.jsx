import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { Search, Filter, Download, Package, Warehouse, Truck, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

const COLS = [
  { key: "date", label: "Date" },
  { key: "user", label: "User" },
  { key: "type", label: "Type" },
  { key: "material", label: "Material" },
  { key: "barcode", label: "Barcode" },
  { key: "manufacturer", label: "Manufacturer" },
  { key: "category", label: "Category" },
  { key: "quantity", label: "Qty" },
  { key: "unit", label: "Unit" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "project", label: "Project" },
  { key: "cost", label: "Estimated Unit Cost" },
  { key: "total_cost", label: "Estimated Total Cost" },
];

const typeConfig = {
  add: { label: "Add", color: "bg-green-100 text-green-700" },
  transfer: { label: "Transfer", color: "bg-blue-100 text-blue-700" },
  use: { label: "Use", color: "bg-orange-100 text-orange-700" },
  adjust: { label: "Adjust", color: "bg-yellow-100 text-yellow-700" },
  shrink: { label: "Shrink", color: "bg-red-100 text-red-700" },
};

const formatUser = (email) => {
  if (!email) return "—";
  if (email.startsWith("service+") || email.includes("@no-reply.base44.com")) return "System";
  return email.split("@")[0];
};

export default function InventoryLog() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterUser, setFilterUser] = useState("all");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AppSettings.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
    staleTime: 60000,
  });
  const companyLogo = settingsList[0]?.logo_url;

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Transaction.filter({ company_id: activeCompanyId }, "-created_date", 500) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Material.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Location.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const getMat = (id) => materials.find((m) => m.id === id);
  const getLoc = (id) => locations.find((l) => l.id === id);

  const userOptions = useMemo(() => {
    const set = new Set(transactions.map(t => t.created_by).filter(Boolean));
    return Array.from(set).sort();
  }, [transactions]);

  const rows = useMemo(() => {
    return transactions.map((tx) => {
      const mat = getMat(tx.material_id);
      const from = getLoc(tx.from_location_id);
      const to = getLoc(tx.to_location_id);
      const totalCost = (mat?.unit_cost || 0) * (tx.quantity || 0);
      return {
        id: tx.id,
        date: tx.created_date,
        type: tx.type,
        user: formatUser(tx.created_by),
        _userEmail: tx.created_by,
        material: mat?.name || "—",
        barcode: mat?.barcode || "—",
        manufacturer: mat?.manufacturer || "—",
        category: mat?.category || "—",
        quantity: (tx.type === "use" || tx.type === "adjust" || tx.type === "shrink") ? -tx.quantity : tx.quantity,
        unit: mat?.unit || "each",
        from: from?.name || "—",
        fromType: from?.type,
        to: to?.name || "—",
        toType: to?.type,
        project: tx.project_name || "—",
        cost: mat?.unit_cost ? `$${mat.unit_cost.toFixed(2)}` : "—",
        total_cost: totalCost > 0 ? `$${totalCost.toFixed(2)}` : "—",
        _fromId: tx.from_location_id,
        _toId: tx.to_location_id,
        _matId: tx.material_id,
      };
    });
  }, [transactions, materials, locations]);

  const filtered = useMemo(() => {
    let result = rows.filter((r) => {
      const matchSearch = !search ||
        r.material.toLowerCase().includes(search.toLowerCase()) ||
        r.barcode.toLowerCase().includes(search.toLowerCase()) ||
        r.manufacturer.toLowerCase().includes(search.toLowerCase()) ||
        r.project.toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === "all" || r.type === filterType;
      const matchLoc = filterLocation === "all" ||
        r._fromId === filterLocation || r._toId === filterLocation;
      const matchUser = filterUser === "all" || r._userEmail === filterUser;
      return matchSearch && matchType && matchLoc && matchUser;
    });

    result = [...result].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === "date") { av = new Date(av); bv = new Date(bv); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [rows, search, filterType, filterLocation, filterUser, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const exportCSV = () => {
    const headers = COLS.map((c) => c.label).join(",");
    const rowData = filtered.map((r) =>
      COLS.map((c) => {
        const v = c.key === "date" ? format(new Date(r.date), "yyyy-MM-dd HH:mm") : r[c.key];
        return `"${v}"`;
      }).join(",")
    );
    const csv = [headers, ...rowData].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingTx) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const logContent = (
    <div className="space-y-4 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Log</h1>
          <p className="text-muted-foreground mt-1">Full audit trail — {filtered.length} records</p>
        </div>
        <div className="flex items-center gap-3">
          {companyLogo && (
            <img src={companyLogo} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
          )}
          <Button onClick={exportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search material, barcode, project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="add">Add</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
            <SelectItem value="use">Use</SelectItem>
            <SelectItem value="adjust">Adjust</SelectItem>
            <SelectItem value="shrink">Shrink</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLocation} onValueChange={setFilterLocation}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.type === "warehouse" ? "🏭" : "🚛"} {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterUser} onValueChange={setFilterUser}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {userOptions.map((u) => (
              <SelectItem key={u} value={u}>{formatUser(u)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Spreadsheet Table */}
      <div className="rounded-xl border overflow-auto shadow-sm bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b sticky top-0 z-10">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortCol === col.key ? (
                      sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} className="px-4 py-12 text-center text-muted-foreground">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No records found
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const tc = typeConfig[row.type] || typeConfig.add;
                return (
                  <tr
                    key={row.id}
                    className={`border-b transition-colors hover:bg-muted/30 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                      {format(new Date(row.date), "MMM d, yyyy HH:mm")}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                      {row.user}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary" className={`text-xs ${tc.color}`}>
                        {tc.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{row.material}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{row.barcode}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{row.manufacturer}</td>
                    <td className="px-3 py-2.5">
                      {row.category !== "—" && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">{row.category}</span>
                      )}
                      {row.category === "—" && <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={`px-3 py-2.5 font-bold text-right ${row.quantity < 0 ? "text-destructive" : "text-green-600"}`}>
                      {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.unit}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.from !== "—" ? (
                        <span className="flex items-center gap-1 text-xs">
                          {row.fromType === "warehouse" ? <Warehouse className="w-3 h-3 text-primary" /> : <Truck className="w-3 h-3 text-secondary" />}
                          {row.from}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.to !== "—" ? (
                        <span className="flex items-center gap-1 text-xs">
                          {row.toType === "warehouse" ? <Warehouse className="w-3 h-3 text-primary" /> : <Truck className="w-3 h-3 text-secondary" />}
                          {row.to}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs">{row.project}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{row.cost}</td>
                    <td className="px-3 py-2.5 text-right text-xs font-medium">{row.total_cost}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Row */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground px-1">
          <span>{filtered.filter((r) => r.type === "add").length} additions</span>
          <span>•</span>
          <span>{filtered.filter((r) => r.type === "transfer").length} transfers</span>
          <span>•</span>
          <span>{filtered.filter((r) => r.type === "use").length} usages</span>
          <span>•</span>
          <span>{filtered.filter((r) => r.type === "adjust").length} adjustments</span>
          <span>•</span>
          <span>{filtered.filter((r) => r.type === "shrink").length} shrinkage</span>
        </div>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <CompanyAccessGate userEmail={user.email}>
      {logContent}
    </CompanyAccessGate>
  );
}