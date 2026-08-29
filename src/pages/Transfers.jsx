import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { ArrowLeftRight, ArrowRight, Plus, Minus, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LocationBadge from "../components/inventory/LocationBadge";
import { format } from "date-fns";

const txConfig = {
  add: { label: "Added", icon: Plus, color: "bg-green-100 text-green-700 border-green-200" },
  transfer: { label: "Transfer", icon: ArrowLeftRight, color: "bg-blue-100 text-blue-700 border-blue-200" },
  use: { label: "Used", icon: Minus, color: "bg-orange-100 text-orange-700 border-orange-200" },
};

export default function Transfers() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AppSettings.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
    staleTime: 60000,
  });
  const companyLogo = settingsList[0]?.logo_url;

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Transaction.filter({ company_id: activeCompanyId }, "-created_date", 100) : Promise.resolve([]),
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

  const isLoading = loadingTx;

  const getMaterial = (id) => materials.find((m) => m.id === id);
  const getLocation = (id) => locations.find((l) => l.id === id);

  const filtered = transactions.filter((tx) => {
    const mat = getMaterial(tx.material_id);
    const matchesSearch = !search ||
      mat?.name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.project_name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const transfersContent = (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground mt-1">All inventory movements and usage records</p>
        </div>
        {companyLogo && (
          <img src={companyLogo} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain self-start sm:self-auto" />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by material or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="add">Added</SelectItem>
            <SelectItem value="transfer">Transfers</SelectItem>
            <SelectItem value="use">Usage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ArrowLeftRight className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No transactions found</h3>
          <p className="text-muted-foreground mt-1">
            {search || filterType !== "all" ? "Try adjusting your filters" : "Start scanning materials to see activity here"}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => {
            const mat = getMaterial(tx.material_id);
            const config = txConfig[tx.type] || txConfig.add;
            const Icon = config.icon;
            const fromLoc = getLocation(tx.from_location_id);
            const toLoc = getLocation(tx.to_location_id);

            return (
              <Card key={tx.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{mat?.name || "Unknown"}</span>
                      <Badge variant="outline" className={`text-xs ${config.color} border`}>
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {tx.type === "add" && toLoc && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          → <LocationBadge location={toLoc} className="text-xs py-0" />
                        </span>
                      )}
                      {tx.type === "transfer" && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <LocationBadge location={fromLoc} className="text-xs py-0" />
                          <ArrowRight className="w-3 h-3" />
                          <LocationBadge location={toLoc} className="text-xs py-0" />
                        </span>
                      )}
                      {tx.type === "use" && (
                        <span className="text-xs text-muted-foreground">
                          {fromLoc && <LocationBadge location={fromLoc} className="text-xs py-0 mr-1" />}
                          {tx.project_name && `• Project: ${tx.project_name}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">
                      {tx.type === "use" ? "-" : tx.type === "add" ? "+" : ""}
                      {tx.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_date), "MMM d, h:mm a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <CompanyAccessGate userEmail={user.email}>
      {transfersContent}
    </CompanyAccessGate>
  );
}