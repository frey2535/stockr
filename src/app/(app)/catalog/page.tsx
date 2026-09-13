"use client";

import { useMemo, useState } from "react";
import { Package, Printer, Plus, Search } from "lucide-react";
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
import { printLabels } from "@/lib/labels";
import { materialBarcode } from "@/lib/id";
import { money } from "@/lib/format";
import { onHand } from "@/lib/inventory";
import type { Material } from "@/lib/types";

const emptyMaterial: Partial<Material> = {
  name: "",
  category: "",
  sub_category: "",
  manufacturer: "",
  supplier: "",
  unit: "each",
  unit_cost: null,
  reorder_point: null,
  min_stock_level: null,
  barcode: "",
  description: "",
};

export default function CatalogPage() {
  const { state, upsertMaterial, deleteMaterial } = useStore();
  const { materials } = state;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sub, setSub] = useState("all");
  const [editing, setEditing] = useState<Partial<Material> | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(materials.map((row) => row.category).filter(Boolean))) as string[],
    [materials],
  );
  const subcategories = useMemo(
    () =>
      Array.from(
        new Set(
          materials
            .filter((row) => category === "all" || row.category === category)
            .map((row) => row.sub_category)
            .filter(Boolean),
        ),
      ) as string[],
    [materials, category],
  );

  const filtered = materials.filter((row) => {
    if (category !== "all" && row.category !== category) return false;
    if (sub !== "all" && row.sub_category !== sub) return false;
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.manufacturer || "").toLowerCase().includes(q) ||
      (row.barcode || "").includes(q)
    );
  });

  const grouped = filtered.reduce<Record<string, Material[]>>((acc, row) => {
    const key = row.category || "Uncategorized";
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});

  const save = async () => {
    if (!editing?.name?.trim()) {
      toast.error("Name is required.");
      return;
    }
    const result = await upsertMaterial(editing);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Material saved");
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalog"
        description="Master list of materials, barcodes, and reorder points"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={() => {
                const result = printLabels(filtered);
                if (result.error) toast.error(result.error);
                else toast.success(`${result.count} label(s) sent to print.`);
              }}
            >
              <Printer className="mr-2 size-4" />
              Print Labels
            </Button>
            <Button
              size="sm"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              onClick={() => setEditing({ ...emptyMaterial })}
            >
              <Plus className="mr-2 size-4" />
              Add Material
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search catalog..."
            className="pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setSub("all");
          }}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sub} onValueChange={setSub}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="All Sub-Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub-Categories</SelectItem>
            {subcategories.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="size-12" />}
          title="No materials found"
          description="Try adjusting your search or filters"
        />
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <section key={group} className="space-y-3">
            <h2 className="text-lg font-semibold">{group}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((material) => (
                <Card key={material.id} className="hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{material.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {[material.manufacturer, material.sub_category].filter(Boolean).join(" · ") || "No manufacturer"}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {material.barcode || materialBarcode(material)}
                        </p>
                        <p className="mt-2 text-sm">
                          On hand {onHand(state, material.id)} {material.unit}
                          {material.unit_cost != null ? ` · $${money(material.unit_cost)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(material)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            deleteMaterial(material.id);
                            toast.success("Material deleted");
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Material" : "Add Material"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={editing.name || ""}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={editing.category || ""}
                    onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                    placeholder="e.g. Conduit"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sub-Category</Label>
                  <Input
                    value={editing.sub_category || ""}
                    onChange={(event) => setEditing({ ...editing, sub_category: event.target.value })}
                    placeholder="e.g. EMT, PVC, Rigid"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Manufacturer</Label>
                  <Input
                    value={editing.manufacturer || ""}
                    onChange={(event) => setEditing({ ...editing, manufacturer: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Supplier</Label>
                  <Input
                    value={editing.supplier || ""}
                    onChange={(event) => setEditing({ ...editing, supplier: event.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={editing.unit || ""}
                    onChange={(event) => setEditing({ ...editing, unit: event.target.value })}
                    placeholder="each / ft / box"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Unit Cost ($)</Label>
                  <Input
                    type="number"
                    value={editing.unit_cost ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        unit_cost: event.target.value ? parseFloat(event.target.value) : null,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Reorder Point</Label>
                  <Input
                    type="number"
                    value={editing.reorder_point ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        reorder_point: event.target.value ? parseFloat(event.target.value) : null,
                      })
                    }
                    placeholder="Reorder when qty ≤"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min Stock Level</Label>
                  <Input
                    type="number"
                    value={editing.min_stock_level ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        min_stock_level: event.target.value ? parseFloat(event.target.value) : null,
                      })
                    }
                    placeholder="Safety stock floor"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Barcode</Label>
                <Input
                  value={editing.barcode || ""}
                  onChange={(event) => setEditing({ ...editing, barcode: event.target.value })}
                  placeholder="Leave blank to auto-assign STK code"
                />
              </div>
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={save}>
                Save Material
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
