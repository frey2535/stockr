import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import { BookOpen, Search, Filter, Package, Pencil, Check, DollarSign, Tag, Barcode, ChevronDown, ChevronRight, Zap, Printer, Sparkles, ImagePlus, Loader2 } from "lucide-react";
import { printLabels, generateInternalBarcode } from "@/utils/barcodeLabels";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Catalog() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSubCategory, setFilterSubCategory] = useState("all");
  const [filterManufacturer, setFilterManufacturer] = useState("all");
  const [editingItem, setEditingItem] = useState(null);
  const [editFields, setEditFields] = useState({});
  const [generatingImage, setGeneratingImage] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [collapsedSubCategories, setCollapsedSubCategories] = useState({});
  const queryClient = useQueryClient();
  const { activeCompanyId } = useUserCompanyId();

  const { data: materials = [], isLoading, error: queryError, isFetching } = useQuery({
    queryKey: ["materials", "catalog", activeCompanyId],
    queryFn: async () => {
      return await base44.entities.Material.filter({ company_id: activeCompanyId });
    },
    enabled: !!activeCompanyId && activeCompanyId.startsWith('co_'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Material.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", "catalog", activeCompanyId] });
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Material.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials", "catalog", activeCompanyId] });
      setEditingItem(null);
    },
  });

  const pricingMutation = useMutation({
    mutationFn: () => base44.functions.invoke('bulkPriceLookup', { company_id: activeCompanyId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["materials", "catalog", activeCompanyId] });
      const companyName = res.data.company_name || activeCompanyId;
      toast({
        title: "Pricing Complete",
        description: `${companyName}: ${res.data.priced} items priced, ${res.data.skipped} skipped.`,
        variant: res.data.skipped > 0 ? "destructive" : "default"
      });
    },
    onError: (err) => {
      toast({
        title: "Pricing Failed",
        description: err.message || "Could not fetch prices",
        variant: "destructive"
      });
    }
  });

  const categories = useMemo(() =>
    [...new Set(materials.map(m => m.category).filter(Boolean))].sort()
  , [materials]);

  const subCategories = useMemo(() => {
    const src = filterCategory === "all" ? materials : materials.filter(m => m.category === filterCategory);
    return [...new Set(src.map(m => m.sub_category).filter(Boolean))].sort();
  }, [materials, filterCategory]);

  const manufacturers = useMemo(() =>
    [...new Set(materials.map(m => m.manufacturer).filter(Boolean))].sort()
  , [materials]);

  const filtered = useMemo(() => {
    return materials.filter(m => {
      const searchLower = search.toLowerCase();
      const matchesSearch = !search ||
        m.name?.toLowerCase().includes(searchLower) ||
        m.barcode?.toLowerCase().includes(searchLower) ||
        m.manufacturer?.toLowerCase().includes(searchLower) ||
        m.category?.toLowerCase().includes(searchLower) ||
        m.sub_category?.toLowerCase().includes(searchLower) ||
        m.item_type?.toLowerCase().includes(searchLower) ||
        m.description?.toLowerCase().includes(searchLower) ||
        (m.aliases || []).some(a => a.toLowerCase().includes(searchLower));
      const matchesCategory = filterCategory === "all" || m.category === filterCategory;
      const matchesSubCategory = filterSubCategory === "all" || m.sub_category === filterSubCategory;
      const matchesMfr = filterManufacturer === "all" || m.manufacturer === filterManufacturer;
      return matchesSearch && matchesCategory && matchesSubCategory && matchesMfr;
    });
  }, [materials, search, filterCategory, filterSubCategory, filterManufacturer]);

  // Group: category -> sub_category -> items
  const grouped = useMemo(() => {
    const catMap = {};
    filtered.forEach(m => {
      const cat = m.category || "Uncategorized";
      const sub = m.sub_category || "General";
      if (!catMap[cat]) catMap[cat] = {};
      if (!catMap[cat][sub]) catMap[cat][sub] = [];
      catMap[cat][sub].push(m);
    });
    return Object.entries(catMap)
      .sort(([a], [b]) => {
        if (a === "Uncategorized") return 1;
        if (b === "Uncategorized") return -1;
        return a.localeCompare(b);
      })
      .map(([cat, subMap]) => ({
        category: cat,
        totalItems: Object.values(subMap).flat().length,
        subGroups: Object.entries(subMap)
          .sort(([a], [b]) => {
            if (a === "General") return 1;
            if (b === "General") return -1;
            return a.localeCompare(b);
          })
          .map(([sub, items]) => ({ sub, items }))
      }));
  }, [filtered]);

  const toggleCategory = (cat) =>
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

  const toggleSubCategory = (key) =>
    setCollapsedSubCategories(prev => ({ ...prev, [key]: !prev[key] }));

  const openEdit = (item) => {
    setEditingItem(item);
    setEditFields({ ...item });
  };

  const handleSave = () => {
    updateMutation.mutate({ id: editingItem.id, data: editFields });
  };

  const handleGenerateImage = async () => {
    setGeneratingImage(true);
    try {
      const prompt = `Professional product catalog photograph of an electrical fitting: ${editFields.name || ""}. Clean white background, studio lighting, centered, high detail, no text overlay.`;
      const res = await base44.integrations.Core.GenerateImage({ prompt });
      if (res?.url) {
        setEditFields(f => ({ ...f, image_url: res.url }));
        toast({ title: "Image Generated", description: "Click Save to keep it." });
      } else {
        toast({ title: "Image Generation Failed", description: "No URL returned", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Image Generation Failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-secondary" />
          Material Catalog
        </h1>
        <p className="text-muted-foreground mt-1">
          All material profiles · does not reflect current stock levels
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, barcode, manufacturer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => pricingMutation.mutate()}
          disabled={pricingMutation.isPending || !activeCompanyId}
          className="gap-2"
        >
          <Zap className="w-4 h-4" />
          {pricingMutation.isPending ? 'Pricing...' : 'Refresh Prices'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const result = printLabels(filtered);
            if (result?.error) {
              toast({ title: "Print Labels", description: result.error, variant: "destructive" });
            } else {
              toast({ title: "Labels Generated", description: `${result.count} label(s) sent to PDF.` });
            }
          }}
          disabled={filtered.length === 0}
          className="gap-2"
        >
          <Printer className="w-4 h-4" />
          Print Labels
        </Button>
        <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setFilterSubCategory("all"); }}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 flex-shrink-0" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSubCategory} onValueChange={setFilterSubCategory}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2 flex-shrink-0" />
            <SelectValue placeholder="All Sub-Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub-Categories</SelectItem>
            {subCategories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
          <SelectTrigger className="w-full sm:w-44">
            <Tag className="w-4 h-4 mr-2 flex-shrink-0" />
            <SelectValue placeholder="All Manufacturers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Manufacturers</SelectItem>
            {manufacturers.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Results summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{filtered.length} of {materials.length} items</span>
        {(search || filterCategory !== "all" || filterSubCategory !== "all" || filterManufacturer !== "all") && (
          <button
            onClick={() => { setSearch(""); setFilterCategory("all"); setFilterSubCategory("all"); setFilterManufacturer("all"); }}
            className="text-secondary underline hover:no-underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grouped Catalog: Category → Sub-Category → Items */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold">No items found</h3>
          <p className="text-muted-foreground mt-1">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, totalItems, subGroups }) => {
            const catCollapsed = collapsedCategories[category];
            return (
              <div key={category} className="border rounded-xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-5 py-3 bg-primary/5 hover:bg-primary/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold">{category}</h2>
                    <Badge variant="outline" className="text-xs">{totalItems} item{totalItems !== 1 ? "s" : ""}</Badge>
                  </div>
                  {catCollapsed
                    ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  }
                </button>

                {/* Sub-Categories */}
                {!catCollapsed && (
                  <div className="divide-y">
                    {subGroups.map(({ sub, items }) => {
                      const subKey = `${category}__${sub}`;
                      const subCollapsed = collapsedSubCategories[subKey];
                      return (
                        <div key={sub}>
                          {/* Sub-Category Header */}
                          <button
                            onClick={() => toggleSubCategory(subKey)}
                            className="w-full flex items-center justify-between px-5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-muted-foreground">{sub}</span>
                              <Badge className="text-xs bg-secondary/10 text-secondary border-0">{items.length}</Badge>
                            </div>
                            {subCollapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                          </button>

                          {/* Items Grid */}
                          {!subCollapsed && (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                              {items.map(item => (
                                <Card key={item.id} className="hover:shadow-md transition-shadow group">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex items-start gap-3 min-w-0">
                                        {item.image_url ? (
                                          <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border bg-muted flex-shrink-0 mt-0.5" />
                                        ) : (
                                          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Package className="w-4 h-4 text-primary" />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-semibold text-sm leading-snug">{item.name}</p>
                                          {item.manufacturer && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{item.manufacturer}</p>
                                          )}
                                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                                            {item.barcode && (
                                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Barcode className="w-3 h-3" />{item.barcode}
                                              </span>
                                            )}
                                            {item.unit_cost && item.unit_cost > 0 && (
                                              <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <DollarSign className="w-3 h-3" />${item.unit_cost.toFixed(2)}/{item.unit || "each"}
                                              </span>
                                            )}
                                            {item.supplier && (
                                              <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                                Supplier: {item.supplier}
                                              </span>
                                            )}
                                            {item.unit && !item.unit_cost && (
                                              <span className="text-xs text-muted-foreground">per {item.unit}</span>
                                            )}
                                          </div>
                                          {item.description && (
                                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{item.description}</p>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-7 w-7"
                                        onClick={() => openEdit(item)}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={open => !open && setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Image preview + generate */}
            <div className="flex items-center gap-3 pb-3 border-b">
              {editFields.image_url ? (
                <img src={editFields.image_url} alt="Preview" className="w-16 h-16 rounded-lg object-cover border bg-muted" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center border">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateImage}
                  disabled={generatingImage || !editFields.name}
                  className="gap-1.5"
                >
                  {generatingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  {generatingImage ? "Generating…" : editFields.image_url ? "Regenerate" : "Generate Image"}
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">AI product photo on white background.</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input value={editFields.name || ""} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Input value={editFields.category || ""} onChange={e => setEditFields(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Conduit" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sub-Category</Label>
                <Input value={editFields.sub_category || ""} onChange={e => setEditFields(f => ({ ...f, sub_category: e.target.value }))} placeholder="e.g. EMT, PVC, Rigid" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Manufacturer</Label>
                <Input value={editFields.manufacturer || ""} onChange={e => setEditFields(f => ({ ...f, manufacturer: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Supplier</Label>
                <Input value={editFields.supplier || ""} onChange={e => setEditFields(f => ({ ...f, supplier: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input value={editFields.unit || ""} onChange={e => setEditFields(f => ({ ...f, unit: e.target.value }))} placeholder="each / ft / box" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit Cost ($)</Label>
                <Input type="number" value={editFields.unit_cost || ""} onChange={e => setEditFields(f => ({ ...f, unit_cost: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Reorder Point</Label>
                <Input type="number" value={editFields.reorder_point ?? ""} onChange={e => setEditFields(f => ({ ...f, reorder_point: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Reorder when qty ≤" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Stock Level</Label>
                <Input type="number" value={editFields.min_stock_level ?? ""} onChange={e => setEditFields(f => ({ ...f, min_stock_level: e.target.value ? parseFloat(e.target.value) : null }))} placeholder="Safety stock floor" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Barcode</Label>
              <div className="flex gap-2">
                <Input value={editFields.barcode || ""} onChange={e => setEditFields(f => ({ ...f, barcode: e.target.value }))} className="flex-1" />
                {!editFields.barcode && editingItem?.id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditFields(f => ({ ...f, barcode: generateInternalBarcode(editingItem.id) }))}
                    className="gap-1.5 flex-shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Generate
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Leave empty and click Generate for an internal Stockr barcode.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={editFields.description || ""} onChange={e => setEditFields(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                className="mr-auto"
                onClick={() => deleteMutation.mutate(editingItem.id)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>Cancel</Button>
              <Button
                size="sm"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                <Check className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
          </div>
          </DialogContent>
          </Dialog>
          </div>
          );
          }