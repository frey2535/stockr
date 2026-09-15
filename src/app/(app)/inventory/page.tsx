"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { BulkInventoryDialog } from "@/components/bulk-inventory-dialog";
import { PageHeader } from "@/components/page-header";
import { ProjectSelect } from "@/components/project-select";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { usePagedApi } from "@/lib/use-api";
import { money, qty } from "@/lib/format";
import { needsFrom, needsProject, needsTo } from "@/lib/tx";
import type { TxType } from "@/lib/types";
import type { InventoryListPayload } from "@/lib/workspace-types";

function InventoryPageInner() {
  const { workspace, applyAction, setStockRule } = useStore();
  const { settings, locations, projects } = workspace;
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [locationId, setLocationId] = useState(searchParams.get("location") || "all");
  const [stock, setStock] = useState(searchParams.get("stock") || "all");
  const [ruleLocationId, setRuleLocationId] = useState("");
  const [ruleMin, setRuleMin] = useState("");
  const [ruleMax, setRuleMax] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [actionType, setActionType] = useState<TxType>("adjust");
  const [quantity, setQuantity] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [project, setProject] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<TxType>("add");
  const openBulk = (type: TxType) => {
    setBulkAction(type);
    setBulkOpen(true);
  };
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (locationId !== "all") params.set("location", locationId);
  if (stock !== "all") params.set("stock", stock);
  const { data, reload, hasMore, loadMore, loading } = usePagedApi<InventoryListPayload>(
    `/api/inventory?${params.toString()}`,
  );
  const rows = data?.rows || [];
  const selected = rows.find((row) => row.material.id === active)?.material;

  const commit = async () => {
    if (!selected) return;
    if (needsProject(actionType) && !project.trim()) {
      toast.error("Pick the job this material belongs to.");
      return;
    }
    const result = await applyAction({
      type: actionType,
      materialId: selected.id,
      quantity: parseFloat(quantity),
      fromLocationId: needsFrom(actionType) ? fromId : null,
      toLocationId: needsTo(actionType) ? toId : null,
      project: needsProject(actionType) ? project : null,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Inventory updated");
    setActive(null);
    setQuantity("");
    await reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="All materials across all locations"
        actions={
          settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
          ) : null
        }
      />

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">Bulk add, receive, transfer, use, return, count, or shrink</p>
          <div className="flex flex-wrap gap-2">
            {([
              ["receive", "Receive"],
              ["use", "Use"],
              ["return", "Return"],
              ["transfer", "Transfer"],
              ["add", "Add"],
              ["count", "Count"],
              ["adjust", "Adjust"],
              ["shrink", "Shrink"],
            ] as const).map(([type, label]) => (
              <Button key={type} variant="outline" onClick={() => openBulk(type)}>
                Bulk {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, barcode, MPN, UPC, supplier #..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stock} onValueChange={setStock}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low">Below min</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No inventory on hand."
          description={query || locationId !== "all" ? "Try adjusting your search or filters" : "Scan some materials to get started!"}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.material.id} className="hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{row.material.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {row.material.category || "Uncategorized"}
                      {row.material.unit_cost != null ? ` · $${money(row.material.unit_cost)} / ${row.material.unit}` : ` · ${row.material.unit}`}
                    </p>
                    <div className="mt-3 space-y-1">
                      {row.byLocation.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None on hand</p>
                      ) : (
                        row.byLocation.map((item) => (
                          <div key={item.location.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.location.name}</span>
                            <span className={item.belowMin ? "font-medium text-orange-700" : "font-medium"}>
                              {qty(item.quantity)} {row.material.unit}
                              {item.min != null ? ` · min ${qty(item.min)}` : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{qty(row.total)}</p>
                    <p className="text-xs text-muted-foreground">{row.material.unit}</p>
                    <div className="mt-3 flex flex-wrap justify-end gap-1">
                      {(["use", "return", "receive", "transfer", "add", "count", "adjust", "shrink"] as TxType[]).map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant={type === "adjust" ? "default" : "outline"}
                          className={
                            type === "adjust"
                              ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 capitalize"
                              : "capitalize"
                          }
                          onClick={() => {
                            setActive(row.material.id);
                            setActionType(type);
                            setToId(row.byLocation[0]?.location.id || locations[0]?.id || "");
                            setFromId(row.byLocation[0]?.location.id || locations[0]?.id || "");
                            setQuantity(type === "adjust" || type === "count" ? String(row.byLocation[0]?.quantity || 0) : "1");
                            setProject("");
                            setRuleLocationId(row.byLocation[0]?.location.id || locations[0]?.id || "");
                            setRuleMin(row.byLocation[0]?.min != null ? String(row.byLocation[0].min) : "");
                            setRuleMax(row.byLocation[0]?.max != null ? String(row.byLocation[0].max) : "");
                          }}
                        >
                          {type === "shrink" ? "Shrink" : type === "count" ? "Count" : type}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasMore ? (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loading}>
              {loading ? "Loading…" : `Load more (${rows.length} of ${data?.total || 0})`}
            </Button>
          ) : null}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Action</Label>
              <Select value={actionType} onValueChange={(value) => setActionType(value as TxType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="use">Use on job</SelectItem>
                    <SelectItem value="return">Return from job</SelectItem>
                    <SelectItem value="receive">Receive</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="add">Add</SelectItem>
                    <SelectItem value="count">Cycle count</SelectItem>
                    <SelectItem value="adjust">Adjust</SelectItem>
                    <SelectItem value="shrink">Shrinkage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            {needsFrom(actionType) ? (
              <div className="space-y-1">
                <Label className="text-xs">From Location</Label>
                <Select value={fromId} onValueChange={setFromId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {needsTo(actionType) ? (
              <div className="space-y-1">
                <Label className="text-xs">To Location</Label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {needsProject(actionType) ? (
              <div className="space-y-1">
                <Label className="text-xs">Job / Buildr project *</Label>
                <ProjectSelect projects={projects} value={project} allowNone={false} onChange={setProject} />
              </div>
            ) : null}
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={commit}>
              Save
            </Button>
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium">Location min / max</p>
              <Select value={ruleLocationId} onValueChange={setRuleLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Min" value={ruleMin} onChange={(event) => setRuleMin(event.target.value)} />
                <Input type="number" placeholder="Max" value={ruleMax} onChange={(event) => setRuleMax(event.target.value)} />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  if (!selected || !ruleLocationId) return;
                  const result = await setStockRule({
                    material_id: selected.id,
                    location_id: ruleLocationId,
                    min: Number(ruleMin),
                    max: ruleMax ? Number(ruleMax) : null,
                  });
                  if (!result.ok) {
                    toast.error(result.error || "Could not save min/max.");
                    return;
                  }
                  toast.success("Min/max saved. Restock board will use this rule.");
                  await reload();
                }}
              >
                Save min / max
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <BulkInventoryDialog
        key={bulkAction}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        materials={rows.map((row) => row.material)}
        initialAction={bulkAction}
        onDone={reload}
      />
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      }
    >
      <InventoryPageInner />
    </Suspense>
  );
}
