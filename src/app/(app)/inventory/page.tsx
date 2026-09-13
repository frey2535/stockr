"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
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
import { money, qty } from "@/lib/format";
import { onHand } from "@/lib/inventory";
import type { TxType } from "@/lib/types";

export default function InventoryPage() {
  const { state, applyAction } = useStore();
  const { settings, materials, locations, inventory } = state;
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [active, setActive] = useState<string | null>(null);
  const [actionType, setActionType] = useState<TxType>("adjust");
  const [quantity, setQuantity] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  const rows = useMemo(() => {
    return materials
      .map((material) => {
        const byLocation = locations
          .map((location) => ({
            location,
            quantity: onHand(state, material.id, location.id),
          }))
          .filter((row) => row.quantity > 0);
        const total = byLocation.reduce((sum, row) => sum + row.quantity, 0);
        return { material, byLocation, total };
      })
      .filter((row) => {
        if (locationId !== "all" && !row.byLocation.some((item) => item.location.id === locationId)) {
          return false;
        }
        const q = query.toLowerCase();
        if (!q) return true;
        return (
          row.material.name.toLowerCase().includes(q) ||
          (row.material.category || "").toLowerCase().includes(q) ||
          (row.material.barcode || "").includes(q)
        );
      })
      .sort((a, b) => a.material.name.localeCompare(b.material.name));
  }, [materials, locations, state, query, locationId]);

  const selected = materials.find((row) => row.id === active);

  const commit = async () => {
    if (!selected) return;
    const result = await applyAction({
      type: actionType,
      materialId: selected.id,
      quantity: parseFloat(quantity),
      fromLocationId: actionType === "add" ? null : fromId,
      toLocationId: actionType === "use" || actionType === "shrink" ? null : toId,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Inventory updated");
    setActive(null);
    setQuantity("");
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
                      {row.byLocation.map((item) => (
                        <div key={item.location.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.location.name}</span>
                          <span className="font-medium">
                            {qty(item.quantity)} {row.material.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">{qty(row.total)}</p>
                    <p className="text-xs text-muted-foreground">{row.material.unit}</p>
                    <Button
                      size="sm"
                      className="mt-3 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                      onClick={() => {
                        setActive(row.material.id);
                        setActionType("adjust");
                        setToId(row.byLocation[0]?.location.id || locations[0]?.id || "");
                        setFromId(row.byLocation[0]?.location.id || locations[0]?.id || "");
                        setQuantity(String(row.byLocation[0]?.quantity || 0));
                      }}
                    >
                      Adjust
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
            <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={commit}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
