"use client";

import { useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Tool, ToolStatus } from "@/lib/types";

const STATUS: Record<ToolStatus, string> = {
  available: "bg-green-100 text-green-700",
  checked_out: "bg-orange-100 text-orange-700",
  maintenance: "bg-gray-100 text-gray-700",
};

const emptyTool: Partial<Tool> = {
  name: "",
  category: "",
  barcode: "",
  assigned_to: "",
  status: "available",
};

export default function ToolsPage() {
  const { workspace, upsertTool, deleteTool } = useStore();
  const { tools, locations } = workspace;
  const [editing, setEditing] = useState<Partial<Tool> | null>(null);

  const save = async () => {
    if (!editing?.name?.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!editing.assigned_location_id) {
      toast.error("Assign the tool to a warehouse or vehicle.");
      return;
    }
    const result = await upsertTool(editing);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tool saved");
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools"
        description="Tools assigned to warehouses and vehicles"
        icon={<Wrench className="size-7 text-secondary" />}
        actions={
          <Button
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            onClick={() =>
              setEditing({
                ...emptyTool,
                assigned_location_id: locations[0]?.id,
              })
            }
          >
            <Plus className="mr-2 size-4" />
            Add tool
          </Button>
        }
      />

      {tools.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-12" />}
          title="No tools yet"
          description="Add meters, drills, and testers and assign them to a truck or warehouse."
        />
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => {
            const location = locations.find((row) => row.id === tool.assigned_location_id);
            return (
              <Card key={tool.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{tool.name}</h3>
                      <Badge className={STATUS[tool.status]}>{tool.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {location ? `${location.type === "vehicle" ? "Vehicle" : "Warehouse"} · ${location.name}` : "Unassigned"}
                      {tool.assigned_to ? ` · ${tool.assigned_to}` : ""}
                    </p>
                    {tool.barcode ? <p className="mt-1 font-mono text-xs text-muted-foreground">{tool.barcode}</p> : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(tool)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={async () => {
                        await deleteTool(tool.id);
                        toast.success("Tool removed");
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit tool" : "Add tool"}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input value={editing.name || ""} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input
                    value={editing.category || ""}
                    onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                    placeholder="Meters, power tools…"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Barcode</Label>
                  <Input
                    value={editing.barcode || ""}
                    onChange={(event) => setEditing({ ...editing, barcode: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned location *</Label>
                <Select
                  value={editing.assigned_location_id || ""}
                  onValueChange={(value) => setEditing({ ...editing, assigned_location_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Warehouse or vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.type === "warehouse" ? "🏭" : "🚛"} {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Assigned to</Label>
                  <Input
                    value={editing.assigned_to || ""}
                    onChange={(event) => setEditing({ ...editing, assigned_to: event.target.value })}
                    placeholder="Crew member"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={editing.status || "available"}
                    onValueChange={(value) => setEditing({ ...editing, status: value as ToolStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="checked_out">Checked out</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={save}>
                Save tool
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
