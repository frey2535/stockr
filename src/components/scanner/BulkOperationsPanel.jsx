import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  X, Plus, Minus, ArrowLeftRight, Search, Trash2, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, Package, ClipboardList
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ACTION_OPTIONS = [
  { value: "add", label: "Add to Inventory", icon: <Plus className="w-4 h-4" /> },
  { value: "transfer", label: "Transfer", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: "use", label: "Use on Project", icon: <Minus className="w-4 h-4" /> },
];

export default function BulkOperationsPanel({
  materials,
  locations,
  inventoryItems,
  buildrProjects,
  activeCompanyId,
  onClose,
  onComplete,
}) {
  // --- Context (set once) ---
  const [actionType, setActionType] = useState("add");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [project, setProject] = useState("");

  // --- Item selection ---
  const [search, setSearch] = useState("");
  const [cartItems, setCartItems] = useState([]); // { material, quantity, status, error }
  const searchRef = useRef(null);

  // --- Submit state ---
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { succeeded, failed, skipped }

  const getAvailableQty = (materialId, locationId) => {
    if (!locationId) return 0;
    const item = inventoryItems.find(i => i.material_id === materialId && i.location_id === locationId);
    return item?.quantity || 0;
  };

  // Filtered material search results (exclude already-in-cart)
  const cartIds = new Set(cartItems.map(c => c.material.id));
  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return materials
      .filter(m => !cartIds.has(m.id))
      .filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.manufacturer || "").toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q) ||
        (m.barcode || "").includes(q)
      )
      .slice(0, 10);
  }, [search, materials, cartIds]);

  const addToCart = (material) => {
    setCartItems(prev => [...prev, { material, quantity: 1, status: "pending", error: null }]);
    setSearch("");
    searchRef.current?.focus();
  };

  const updateQty = (idx, val) => {
    const n = parseInt(val) || 0;
    setCartItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: n } : item));
  };

  const removeFromCart = (idx) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Cumulative validation: builds a running deduction map so combined quantities
  // across rows sharing the same material+location are checked together.
  const validateRows = () => {
    // Running balance map: key = "materialId|locationId", value = remaining available
    const runningBalance = {};

    const getBalance = (materialId, locationId) => {
      const key = `${materialId}|${locationId}`;
      if (!(key in runningBalance)) {
        runningBalance[key] = getAvailableQty(materialId, locationId);
      }
      return runningBalance[key];
    };

    // Duplicate detection: key = "materialId|fromLoc|toLoc|action"
    const seenKeys = {};
    const duplicateIndices = new Set();
    cartItems.forEach((item, idx) => {
      const dupKey = `${item.material.id}|${fromLocationId}|${toLocationId}|${actionType}`;
      if (seenKeys[dupKey] !== undefined) {
        duplicateIndices.add(seenKeys[dupKey]);
        duplicateIndices.add(idx);
      } else {
        seenKeys[dupKey] = idx;
      }
    });

    return cartItems.map((item, idx) => {
      // Basic quantity check (all actions)
      if (item.quantity <= 0) return { ...item, error: "Quantity must be > 0" };

      // Duplicate row check
      if (duplicateIndices.has(idx)) {
        return { ...item, error: "Duplicate row — merge or remove before submitting" };
      }

      // Cumulative stock check for transfer and use
      if (actionType === "transfer" || actionType === "use") {
        const balance = getBalance(item.material.id, fromLocationId);
        if (item.quantity > balance) {
          const orig = getAvailableQty(item.material.id, fromLocationId);
          return {
            ...item,
            error: `Insufficient stock (${orig} available, ${balance} remaining after earlier rows)`,
          };
        }
        // Deduct from running balance for subsequent rows
        const key = `${item.material.id}|${fromLocationId}`;
        runningBalance[key] = balance - item.quantity;
      }

      return { ...item, error: null };
    });
  };

  const contextValid = () => {
    if (actionType === "add" && !toLocationId) return "Select a destination location";
    if (actionType === "transfer" && !fromLocationId) return "Select a source location";
    if (actionType === "transfer" && !toLocationId) return "Select a destination location";
    if (actionType === "transfer" && fromLocationId && toLocationId && fromLocationId === toLocationId)
      return "Source and destination cannot be the same location";
    if (actionType === "use" && !fromLocationId) return "Select a source location";
    if (cartItems.length === 0) return "Add at least one item";
    return null;
  };

  const handleSubmit = async () => {
    if (!activeCompanyId) { toast.error("Company context missing — cannot proceed"); return; }

    const ctxError = contextValid();
    if (ctxError) { toast.error(ctxError); return; }

    const validated = validateRows();
    setCartItems(validated);

    const hasErrors = validated.some(r => r.error);
    if (hasErrors) {
      toast.error("Fix row errors before submitting");
      return;
    }

    setSubmitting(true);
    let succeeded = 0, failed = 0, skipped = 0;
    const updatedRows = [...validated];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      const mat = row.material;
      const qty = row.quantity;

      try {
        const traceMsg = `TRACE: BulkOperationsPanel handleSubmit fired | material=${mat.id} | action=${actionType} | company=${activeCompanyId} | time=${new Date().toISOString()}`;
        toast.info(traceMsg);
        const response = await base44.functions.invoke('processInventoryAction', {
          actionType,
          materialId: mat.id,
          quantity: qty,
          fromLocationId: fromLocationId || null,
          toLocationId: toLocationId || null,
          projectName: project || null,
          company_id: activeCompanyId,
        });

        if (response.data?.error) {
          throw new Error(response.data.error.message || "Action failed");
        }

        updatedRows[i] = { ...row, status: "success", error: null };
        succeeded++;
      } catch (err) {
        updatedRows[i] = { ...row, status: "error", error: err.message || "Failed" };
        failed++;
      }
    }

    setCartItems(updatedRows);
    setSubmitting(false);
    setResults({ succeeded, failed, skipped });
    onComplete({ succeeded, failed });
  };

  // Summary screen after submit
  if (results) {
    return (
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Bulk Submit Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-600">{results.succeeded}</p>
              <p className="text-xs text-green-700">Succeeded</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-600">{results.failed}</p>
              <p className="text-xs text-red-700">Failed</p>
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-2xl font-bold text-muted-foreground">{results.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
          </div>

          {/* Show failed rows */}
          {results.failed > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive">Failed rows:</p>
              {cartItems.filter(r => r.status === "error").map((r, i) => (
                <div key={i} className="text-xs bg-red-50 rounded px-3 py-1.5 flex justify-between">
                  <span className="font-medium">{r.material.name}</span>
                  <span className="text-red-600">{r.error}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => {
              setResults(null);
              setCartItems(cartItems.filter(r => r.status === "error"));
            }}>
              Retry Failed
            </Button>
            <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={onClose}>
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ctxErr = contextValid();
  const sourceLocId = actionType === "add" ? null : fromLocationId;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Bulk Operations
            {cartItems.length > 0 && (
              <Badge className="ml-1 bg-secondary text-secondary-foreground">{cartItems.length} items</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Step 1: Context (set once) ── */}
        <div className="bg-muted/40 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Set Once</p>

          {/* Action */}
          <div className="grid grid-cols-3 gap-2">
            {ACTION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setActionType(opt.value); setFromLocationId(""); setToLocationId(""); }}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition-colors ${
                  actionType === opt.value
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-border bg-card text-muted-foreground hover:border-secondary/50"
                }`}
              >
                {opt.icon}
                {opt.label.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Locations */}
          <div className="grid grid-cols-1 gap-2">
            {(actionType === "transfer" || actionType === "use") && (
              <div className="space-y-1">
                <Label className="text-xs">From Location</Label>
                <Select value={fromLocationId} onValueChange={setFromLocationId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.type === "warehouse" ? "🏭" : "🚛"} {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(actionType === "add" || actionType === "transfer") && (
              <div className="space-y-1">
                <Label className="text-xs">To Location</Label>
                <Select value={toLocationId} onValueChange={setToLocationId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.filter(l => l.id !== fromLocationId).map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.type === "warehouse" ? "🏭" : "🚛"} {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {actionType === "use" && (
              <div className="space-y-1">
                <Label className="text-xs">Project</Label>
                {buildrProjects?.length > 0 ? (
                  <Select value={project} onValueChange={setProject}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {buildrProjects.map(p => (
                        <SelectItem key={p.id} value={p.name}>
                          {p.project_number} - {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8 text-xs"
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    placeholder="Project name..."
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: Search & Add Items ── */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Add Items</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchRef}
              className="pl-8 h-8 text-sm"
              placeholder="Search by name, brand, category, barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Search results dropdown */}
          {filteredMaterials.length > 0 && (
            <div className="border rounded-lg overflow-hidden shadow-sm">
              {filteredMaterials.map(m => {
                const avail = sourceLocId ? getAvailableQty(m.id, sourceLocId) : null;
                const totalStock = inventoryItems
                  .filter(i => i.material_id === m.id)
                  .reduce((sum, i) => sum + (i.quantity || 0), 0);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addToCart(m)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-muted/60 transition-colors border-b last:border-b-0 bg-card"
                  >
                    <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[m.manufacturer, m.category].filter(Boolean).join(" · ")}
                        {totalStock > 0
                          ? <span className="text-green-600 font-medium"> · {totalStock} in stock</span>
                          : <span className="text-red-500 font-medium"> · out of stock</span>
                        }
                      </p>
                    </div>
                    {avail !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${avail > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {avail} avail
                      </span>
                    )}
                    <Plus className="w-4 h-4 text-secondary flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {search.trim() && filteredMaterials.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No materials found for "{search}"</p>
          )}
        </div>

        {/* ── Step 3: Cart ── */}
        {cartItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Selected Items ({cartItems.length})</Label>
              <button type="button" onClick={() => setCartItems([])} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Clear all
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
              {cartItems.map((row, idx) => {
                const avail = sourceLocId ? getAvailableQty(row.material.id, sourceLocId) : null;
                const hasError = !!row.error;
                const isSuccess = row.status === "success";

                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors ${
                      isSuccess ? "bg-green-50 border-green-200" :
                      hasError ? "bg-red-50 border-red-200" :
                      "bg-card border-border"
                    }`}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0 w-5">
                      {isSuccess && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                      {hasError && !isSuccess && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{row.material.name}</p>
                      {(row.material.manufacturer || avail !== null) && (
                        <p className="text-xs text-muted-foreground">
                          {row.material.manufacturer}
                          {avail !== null && (
                            <span className={avail < row.quantity ? " text-red-500 font-medium" : " text-green-600"}>
                              {row.material.manufacturer ? " · " : ""}{avail} avail
                            </span>
                          )}
                        </p>
                      )}
                      {hasError && (
                        <p className="text-xs text-red-600 font-medium">{row.error}</p>
                      )}
                    </div>

                    {/* Quantity controls */}
                    {!isSuccess && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(idx, row.quantity - 1)}
                          className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                          disabled={row.quantity <= 1}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={e => updateQty(idx, e.target.value)}
                          className="w-14 h-6 text-center text-xs px-1"
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(idx, row.quantity + 1)}
                          className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Remove */}
                    {!isSuccess && (
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
            disabled={submitting || cartItems.length === 0 || !!ctxErr}
            onClick={handleSubmit}
            title={ctxErr || ""}
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              : <><CheckCircle2 className="w-4 h-4 mr-2" />Submit All ({cartItems.length})</>
            }
          </Button>
        </div>

        {ctxErr && cartItems.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">{ctxErr}</p>
        )}
      </CardContent>
    </Card>
  );
}