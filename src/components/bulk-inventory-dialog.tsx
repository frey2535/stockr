"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BulkMaterialImport } from "@/components/bulk-material-import";
import { ProjectSelect } from "@/components/project-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { InventoryAction, Material, TxType } from "@/lib/types";

type Line = { material: Material; quantity: number };

export function BulkInventoryDialog({
  open,
  onOpenChange,
  materials,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materials: Material[];
  onDone?: () => Promise<void> | void;
}) {
  const { workspace, applyBulkActions, upsertMaterial } = useStore();
  const { locations, projects } = workspace;
  const [fetched, setFetched] = useState<Material[]>([]);
  const catalog = fetched.length ? fetched : materials;
  const [actionType, setActionType] = useState<TxType>("add");
  const [fromId, setFromId] = useState(locations[0]?.id || "");
  const [toId, setToId] = useState(locations[0]?.id || "");
  const [project, setProject] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/materials?limit=100")
      .then((response) => response.json())
      .then((data: { rows?: Material[] }) => {
        if (!cancelled && data.rows?.length) setFetched(data.rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const commit = async () => {
    if (!lines.length) {
      toast.error("Add at least one material.");
      return;
    }
    const actions: InventoryAction[] = lines.map((line) => ({
      type: actionType,
      materialId: line.material.id,
      quantity: line.quantity,
      fromLocationId: actionType === "add" ? null : fromId,
      toLocationId: actionType === "use" || actionType === "shrink" ? null : toId,
      project: actionType === "use" ? project : null,
    }));
    setBusy(true);
    const result = await applyBulkActions(actions);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Updated ${lines.length} material${lines.length === 1 ? "" : "s"}`);
    setLines([]);
    onOpenChange(false);
    await onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk inventory</DialogTitle>
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
          {actionType !== "add" ? (
            <div className="space-y-1">
              <Label className="text-xs">From location</Label>
              <Select value={fromId} onValueChange={setFromId}>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
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
              <Label className="text-xs">To location</Label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Destination" />
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
          <BulkMaterialImport
            materials={catalog}
            onCreate={upsertMaterial}
            onResolved={(rows) => setLines((prev) => [...prev, ...rows])}
            label="Scan, upload, or create missing catalog items"
          />
          {lines.map((line, index) => (
            <div key={`${line.material.id}-${index}`} className="flex items-center gap-2 rounded-lg border p-2">
              <p className="min-w-0 flex-1 truncate text-sm">{line.material.name}</p>
              <Input
                type="number"
                min="0"
                className="h-8 w-20"
                value={line.quantity}
                onChange={(event) => {
                  const next = [...lines];
                  next[index] = { ...next[index], quantity: parseFloat(event.target.value) || 0 };
                  setLines(next);
                }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                Remove
              </Button>
            </div>
          ))}
          <Button
            className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90"
            onClick={commit}
            disabled={busy}
          >
            {busy ? "Saving…" : `Apply ${actionType} to ${lines.length || 0} line${lines.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
