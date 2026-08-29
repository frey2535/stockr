import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { Package, MapPin, Truck, Warehouse, ArrowLeftRight, ScanLine, TrendingDown, DollarSign, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "../components/inventory/StatCard";
import LocationBadge from "../components/inventory/LocationBadge";
import BuildrSyncPanel from "../components/dashboard/BuildrSyncPanel";
import LowStockAlerts from "../components/dashboard/LowStockAlerts";
import UsageTrendChart from "../components/dashboard/UsageTrendChart";
import { format } from "date-fns";
export default function Dashboard() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  
  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AppSettings.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
    staleTime: 60000,
  });
  const companyLogo = settingsList[0]?.logo_url;

  const { data: materials = [], isLoading: loadingMats } = useQuery({
    queryKey: ["materials", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Material.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: locations = [], isLoading: loadingLocs } = useQuery({
    queryKey: ["locations", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Location.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: inventoryItems = [], isLoading: loadingInv } = useQuery({
    queryKey: ["inventoryItems", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.InventoryItem.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const queryClient = useQueryClient();

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Transaction.filter({ company_id: activeCompanyId }, "-created_date", 200) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const handleDeleteTransaction = async (txId) => {
    try {
      await base44.entities.Transaction.delete(txId);
      queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
    } catch (err) {
      // Transaction may have already been deleted or doesn't exist
      queryClient.invalidateQueries({ queryKey: ["transactions", activeCompanyId] });
    }
  };

  const isLoading = loadingMats || loadingLocs || loadingInv || loadingTx;

  const totalItems = inventoryItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const totalValue = inventoryItems.reduce((sum, i) => {
    const mat = materials.find((m) => m.id === i.material_id);
    return sum + (i.quantity || 0) * (mat?.unit_cost || 0);
  }, 0);
  const vehicleCount = locations.filter((l) => l.type === "vehicle").length;
  const warehouseCount = locations.filter((l) => l.type === "warehouse").length;

  const getLocationName = (id) => locations.find((l) => l.id === id);
  const getMaterialName = (id) => materials.find((m) => m.id === id)?.name || "Unknown";

  const txTypeConfig = {
    add: { label: "Added", color: "bg-green-100 text-green-700" },
    transfer: { label: "Transfer", color: "bg-blue-100 text-blue-700" },
    use: { label: "Used", color: "bg-orange-100 text-orange-700" },
    adjust: { label: "Adjusted", color: "bg-yellow-100 text-yellow-700" },
    shrink: { label: "Shrinkage", color: "bg-red-100 text-red-700" },
  };

  const formatUser = (email) => {
    if (!email) return null;
    if (email.startsWith("service+") || email.includes("@no-reply.base44.com")) return "System";
    return email.split("@")[0];
  };

  if (!activeCompanyId || isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }



  const dashboardContent = (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your inventory at a glance</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {companyLogo && (
            <img
              src={companyLogo}
              alt="Company Logo"
              className="h-14 w-auto max-w-[200px] object-contain"
            />
          )}
          <Link to="/Scanner">
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg shadow-secondary/20">
              <ScanLine className="w-4 h-4 mr-2" />
              Scan Material
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Items" value={totalItems} icon={Package} />
        <StatCard title="Estimated Total Value" value={`$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} icon={DollarSign} accent />
        <StatCard title="Vehicles" value={vehicleCount} subtitle={`${warehouseCount} warehouse(s)`} icon={Truck} />
        <StatCard title="Materials" value={materials.length} subtitle="unique items" icon={Package} accent />
      </div>

      {/* Usage Trend Chart */}
      <UsageTrendChart transactions={transactions} />

      {/* Low Stock Alerts */}
      <LowStockAlerts materials={materials} inventoryItems={inventoryItems} />

      {/* Buildr Sync Testing Panel */}
      <BuildrSyncPanel activeCompanyId={activeCompanyId} />

      {/* Quick Actions + Recent Activity */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Location Summary */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-secondary" />
              Locations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locations yet. Add a warehouse or vehicle to get started.</p>
            ) : (
              locations.map((loc) => {
                const locItems = inventoryItems.filter((i) => i.location_id === loc.id && (i.quantity || 0) > 0);
                const locTotal = locItems.reduce((s, i) => s + (i.quantity || 0), 0);
                return (
                  <div key={loc.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      {loc.type === "warehouse" ? (
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Warehouse className="w-4 h-4 text-primary" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                          <Truck className="w-4 h-4 text-secondary" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{loc.name}</p>
                        <p className="text-xs text-muted-foreground">{locItems.length} materials</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{locTotal}</span>
                  </div>
                );
              })
            )}
            <Link to="/Locations">
              <Button variant="outline" className="w-full mt-2" size="sm">
                Manage Locations
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-secondary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet. Scan some materials to get started!</p>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((tx) => {
                  const config = txTypeConfig[tx.type] || txTypeConfig.add;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
                      <Badge className={config.color} variant="secondary">
                        {config.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{getMaterialName(tx.material_id)}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {tx.type === "transfer" && (
                            <>
                              <LocationBadge location={getLocationName(tx.from_location_id)} className="text-xs py-0" />
                              <span>→</span>
                              <LocationBadge location={getLocationName(tx.to_location_id)} className="text-xs py-0" />
                            </>
                          )}
                          {tx.type === "add" && (
                            <LocationBadge location={getLocationName(tx.to_location_id)} className="text-xs py-0" />
                          )}
                          {tx.type === "use" && tx.project_name && (
                            <span>Project: {tx.project_name}</span>
                          )}
                          {(tx.type === "adjust" || tx.type === "shrink") && (
                            <LocationBadge location={getLocationName(tx.from_location_id)} className="text-xs py-0" />
                          )}
                          {formatUser(tx.created_by) && (
                            <span>· by {formatUser(tx.created_by)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {(tx.type === "use" || tx.type === "adjust" || tx.type === "shrink") ? "-" : tx.type === "add" ? "+" : ""}{tx.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_date), "MMM d")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-1 flex-shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <CompanyAccessGate userEmail={user.email}>
      {dashboardContent}
    </CompanyAccessGate>
  );
}