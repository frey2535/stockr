import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { Package, Search, Warehouse, Truck, ArrowRight, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import LocationBadge from "../components/inventory/LocationBadge";
import InventoryItemActions from "../components/inventory/InventoryItemActions";

export default function Inventory() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterItem, setFilterItem] = useState("all");
  const [filterSize, setFilterSize] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
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

  const { data: locations = [] } = useQuery({
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
  const isLoading = loadingMats || loadingInv;

  // Build inventory view: material + all its locations/quantities
  const inventoryView = useMemo(() => {
    return materials.map((mat) => {
      const items = inventoryItems.filter((i) => i.material_id === mat.id);
      const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      const locationDetails = items.
      filter((i) => i.quantity > 0).
      map((i) => ({
        ...i,
        location: locations.find((l) => l.id === i.location_id)
      }));
      return { ...mat, totalQty, locationDetails };
    }).filter((mat) => mat.totalQty > 0 || inventoryItems.some((i) => i.material_id === mat.id));
  }, [materials, inventoryItems, locations]);

  // Size pattern: matches fractions and whole numbers followed by " or inch
  const SIZE_REGEX = /\b(\d+\/\d+"|\d+"|\d+\.\d+")\b/gi;

  const extractSize = (mat) => {
    const haystack = `${mat.name || ""} ${mat.item_type || ""} ${mat.sub_category || ""}`;
    const match = haystack.match(SIZE_REGEX);
    return match ? match[0] : null;
  };

  // Dynamically derive unique filter options from actual catalog data
  const typeOptions = useMemo(() => {
    const CONDUIT_TYPES = ["EMT", "Rigid", "IMC", "PVC", "RobRoy", "Aluminum"];
    const found = new Set();
    inventoryView.forEach((mat) => {
      const haystack = `${mat.name || ""} ${mat.sub_category || ""} ${mat.category || ""}`.toUpperCase();
      CONDUIT_TYPES.forEach((t) => { if (haystack.includes(t.toUpperCase())) found.add(t); });
    });
    return Array.from(found).sort();
  }, [inventoryView]);

  const itemOptions = useMemo(() => {
    const ITEM_TYPES = ["Connectors", "Couplings", "Conduit Bodies", "Lock Rings", "Bushings", "Straps", "Hangers", "Fittings", "Nipples", "Reducers", "Adapters", "Caps", "Elbows"];
    const found = new Set();
    inventoryView.forEach((mat) => {
      const haystack = `${mat.name || ""} ${mat.item_type || ""} ${mat.sub_category || ""}`.toLowerCase();
      ITEM_TYPES.forEach((i) => { if (haystack.includes(i.toLowerCase())) found.add(i); });
    });
    return Array.from(found).sort();
  }, [inventoryView]);

  const sizeOptions = useMemo(() => {
    const found = new Set();
    inventoryView.forEach((mat) => {
      const s = extractSize(mat);
      if (s) found.add(s);
    });
    return Array.from(found).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [inventoryView]);

  const hasActiveFilters = filterType !== "all" || filterItem !== "all" || filterSize !== "all" || filterLocation !== "all" || search;

  const filtered = useMemo(() => {
    return inventoryView.filter((mat) => {
      const nameLower = mat.name?.toLowerCase() || "";
      const searchLower = search.toLowerCase();

      const matchesSearch = !search ||
        nameLower.includes(searchLower) ||
        mat.barcode?.toLowerCase().includes(searchLower) ||
        mat.manufacturer?.toLowerCase().includes(searchLower) ||
        mat.category?.toLowerCase().includes(searchLower) ||
        mat.sub_category?.toLowerCase().includes(searchLower) ||
        mat.item_type?.toLowerCase().includes(searchLower) ||
        mat.description?.toLowerCase().includes(searchLower) ||
        (mat.aliases || []).some((a) => a.toLowerCase().includes(searchLower));

      const haystack = `${mat.name || ""} ${mat.sub_category || ""} ${mat.category || ""}`.toUpperCase();
      const matchesType = filterType === "all" || haystack.includes(filterType.toUpperCase());

      const itemHaystack = `${mat.name || ""} ${mat.item_type || ""} ${mat.sub_category || ""}`.toLowerCase();
      const matchesItem = filterItem === "all" || itemHaystack.includes(filterItem.toLowerCase());

      const matSize = extractSize(mat);
      const matchesSize = filterSize === "all" || matSize === filterSize;

      const matchesLocation = filterLocation === "all" ||
        mat.locationDetails.some((d) => d.location_id === filterLocation);

      return matchesSearch && matchesType && matchesItem && matchesSize && matchesLocation;
    });
  }, [inventoryView, search, filterLocation, filterType, filterItem, filterSize]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const activeLocation = filterLocation !== "all" ? locations.find((l) => l.id === filterLocation) : null;

  const handleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((mat) => mat.id)));
    }
  };

  const handleBulkDelete = async () => {
    const itemsToDelete = Array.from(selected);
    if (!confirm(`Delete ${itemsToDelete.length} material(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const itemsToRemove = inventoryItems.filter((ii) => itemsToDelete.includes(ii.material_id));
      await Promise.all(itemsToRemove.map((ii) => base44.entities.InventoryItem.delete(ii.id)));
      queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
      setSelected(new Set());
      toast.success(`Deleted ${itemsToDelete.length} item(s)`);
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const inventoryContent = (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {activeLocation ?
          <>
              <div className="flex items-center gap-2 mb-1">
                <button
                onClick={() => {setFilterLocation("all");setSearch("");}}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                
                  ← All Locations
                </button>
              </div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                {activeLocation.type === "warehouse" ? <Warehouse className="w-7 h-7 text-primary" /> : <Truck className="w-7 h-7 text-secondary" />}
                {activeLocation.name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {activeLocation.type === "warehouse" ? "Warehouse" : "Vehicle"} · {filtered.length} material{filtered.length !== 1 ? "s" : ""}
              </p>
            </> :

          <>
              <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
              <p className="text-muted-foreground mt-1">All materials across all locations</p>
            </>
          }
        </div>
        {companyLogo && (
          <img src={companyLogo} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain self-start sm:self-auto" />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, barcode, manufacturer, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10" />
        </div>

        {/* Filter row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Location */}
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="h-10 text-sm w-full min-w-0">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc.id} value={loc.id}>
                  {loc.type === "warehouse" ? "🏭" : "🚛"} {loc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type */}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-10 text-sm w-full min-w-0">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Item */}
          <Select value={filterItem} onValueChange={setFilterItem}>
            <SelectTrigger className="h-10 text-sm w-full min-w-0">
              <SelectValue placeholder="Item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              {itemOptions.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Size */}
          <Select value={filterSize} onValueChange={setFilterSize}>
            <SelectTrigger className="h-10 text-sm w-full min-w-0">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sizes</SelectItem>
              {sizeOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips + clear */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {filterType !== "all" && <Badge variant="secondary" className="gap-1">{filterType} <button onClick={() => setFilterType("all")} className="ml-1 hover:text-destructive">×</button></Badge>}
            {filterItem !== "all" && <Badge variant="secondary" className="gap-1">{filterItem} <button onClick={() => setFilterItem("all")} className="ml-1 hover:text-destructive">×</button></Badge>}
            {filterSize !== "all" && <Badge variant="secondary" className="gap-1">{filterSize} <button onClick={() => setFilterSize("all")} className="ml-1 hover:text-destructive">×</button></Badge>}
            {filterLocation !== "all" && <Badge variant="secondary" className="gap-1">{locations.find(l => l.id === filterLocation)?.name} <button onClick={() => setFilterLocation("all")} className="ml-1 hover:text-destructive">×</button></Badge>}
            {search && <Badge variant="secondary" className="gap-1">"{search}" <button onClick={() => setSearch("")} className="ml-1 hover:text-destructive">×</button></Badge>}
            <button onClick={() => { setFilterType("all"); setFilterItem("all"); setFilterSize("all"); setFilterLocation("all"); setSearch(""); }} className="text-xs text-muted-foreground hover:text-destructive underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Bulk Delete Bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <span className="text-sm font-medium">{selected.size} item(s) selected</span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      {/* Inventory List */}
      {filtered.length === 0 ?
      <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No materials found</h3>
          <p className="text-muted-foreground mt-1">
            {search || filterLocation !== "all" ? "Try adjusting your filters" : "Scan some barcodes to start tracking inventory"}
          </p>
        </Card> :

      <div className="space-y-3">
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <Checkbox
              checked={selected.size === filtered.length && filtered.length > 0}
              onCheckedChange={handleSelectAll}
              className="cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">
              {selected.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
            </span>
          </div>
        )}
          {filtered.map((mat) =>
        <div
          key={mat.id}
          className="flex items-start gap-3 min-w-0 overflow-hidden">
          <Checkbox
            checked={selected.has(mat.id)}
            onCheckedChange={(checked) => {
              const newSelected = new Set(selected);
              if (checked) newSelected.add(mat.id);
              else newSelected.delete(mat.id);
              setSelected(newSelected);
            }}
            className="mt-5 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer group flex-1"
          onClick={() => navigate(`/Scanner?materialId=${mat.id}`)}>
          
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {mat.image_url ? (
                    <img src={mat.image_url} alt={mat.name} className="w-12 h-12 rounded-2xl object-cover border bg-muted flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-semibold">{mat.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {mat.manufacturer &&
                      <span className="text-xs text-muted-foreground">{mat.manufacturer}</span>
                      }
                          {mat.barcode &&
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {mat.barcode}
                            </span>
                      }
                          {mat.category &&
                      <Badge variant="outline" className="text-xs">
                              {mat.category}
                            </Badge>
                      }
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                        <p className="text-2xl font-bold">
                          {activeLocation ?
                       mat.locationDetails.find((d) => d.location_id === activeLocation.id)?.quantity ?? 0 :
                       mat.totalQty}
                        </p>
                        <p className="text-xs text-muted-foreground">{mat.unit || "units"}</p>
                        {(() => {
                          const qty = activeLocation ? (mat.locationDetails.find((d) => d.location_id === activeLocation.id)?.quantity ?? 0) : mat.totalQty;
                          if (mat.min_stock_level != null && qty <= mat.min_stock_level) return <span className="text-xs font-semibold text-red-600">Critical</span>;
                          if (mat.reorder_point != null && qty <= mat.reorder_point) return <span className="text-xs font-semibold text-orange-600">Low</span>;
                          return null;
                        })()}
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <InventoryItemActions
                             material={mat}
                             inventoryItems={mat.locationDetails}
                             locations={locations}
                             activeCompanyId={activeCompanyId}
                           />
                           <span className="text-xs text-secondary font-medium flex items-center gap-1">
                             Actions <ArrowRight className="w-3 h-3" />
                           </span>
                         </div>
                       </div>
                    </div>

                    {/* Location breakdown */}
                    {mat.locationDetails.length > 0 &&
                <div className="flex flex-wrap gap-2 mt-3">
                        {mat.locationDetails.map((d) =>
                  <div
                    key={d.id}
                    className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-lg px-2.5 py-1.5">
                    
                            {d.location?.type === "warehouse" ?
                    <Warehouse className="w-3 h-3 text-primary" /> :

                    <Truck className="w-3 h-3 text-secondary" />
                    }
                            <span className="font-medium">{d.location?.name}</span>
                            <span className="text-muted-foreground">×{d.quantity}</span>
                          </div>
                  )}
                      </div>
                }
                  </div>
                </div>
              </CardContent>
            </Card>
        </div>
        )}
        </div>
      }
    </div>
  );

  if (!user) return null;

  return (
    <CompanyAccessGate userEmail={user.email}>
      {inventoryContent}
    </CompanyAccessGate>
  );
}