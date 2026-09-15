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
import type { TxType } from "@/lib/types";
import type { InventoryListPayload } from "@/lib/workspace-types";

function InventoryPageInner() {
  const { workspace, applyAction } = useStore();
  const { settings, locations, projects } = workspace;
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [locationId, setLocationId] = useState(searchParams.get("location") || "all");
  const [active, setActive] = useState<string | null>(null);
  const [actionType, setActionType] = useState<TxType>("adjust");
  const [quantity, setQuantity] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [project, setProject] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (locationId !== "all") params.set("location", locationId);
  const { data, reload, hasMore, loadMore, loading } = usePagedApi<InventoryListPayload>(
    `/api/inventory?${params.toString()}`,
  );
  const rows = data?.rows || [];
  const selected = rows.find((row) => row.material.id === active)?.material;

  const commit = async () => {
    if (!selected) return;
    const result = await applyAction({
      type: actionType,
      materialId: selected.id,
      quantity: parseFloat(quantity),
      fromLocationId: actionType === "add" ? null : fromId,
      toLocationId: actionType === "use" || actionType === "shrink" ? null : toId,
      project: actionType === "use" ? project : null,
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
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              Bulk operations
            </Button>
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search materials, categories, barcodes..."
            className="pl-9"
          />
        </div>
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
                            <span className="font-medium">
                              {qty(item.quantity)} {row.material.unit}
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
                      {(["use", "transfer", "add", "adjust", "shrink"] as TxType[]).map((type) => (
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
                            setQuantity(type === "adjust" ? String(row.byLocation[0]?.quantity || 0) : "1");
                            setProject("");
                          }}
                        >
                          {type === "shrink" ? "Shrink" : type}
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
        <DialogContent>
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
                  <SelectItem value="add">Add</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="use">Use</SelectItem>
                  <SelectItem value="adjust">Adjust</SelectItem>
                  <SelectItem value="shrink">Shrinkage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </div>
            {actionType !== "add" ? (
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
            {actionType !== "use" && actionType !== "shrink" ? (
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
            {actionType === "use" ? (
              <div className="space-y-1">
                <Label className="text-xs">Buildr project</Label>
                <ProjectSelect projects={projects} value={project} onChange={setProject} />
              </div>
            ) : null}
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={commit}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <BulkInventoryDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        materials={rows.map((row) => row.material)}
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
