"use client";

import { useMemo, useState } from "react";
import { Plus, Truck, UserRound, Warehouse, Wrench } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Location, Tool, ToolStatus } from "@/lib/types";

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

function locationLabel(location: Location) {
  const kind = location.type === "vehicle" ? "Vehicle" : "Warehouse";
  return location.assigned_to ? `${kind} · ${location.name} · ${location.assigned_to}` : `${kind} · ${location.name}`;
}

function ToolCard({
  tool,
  onEdit,
  onDelete,
}: {
  tool: Tool;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium">{tool.name}</h4>
          <Badge className={STATUS[tool.status]}>{tool.status.replace("_", " ")}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {tool.assigned_to ? `Assigned to ${tool.assigned_to}` : "No employee assigned"}
          {tool.category ? ` · ${tool.category}` : ""}
        </p>
        {tool.barcode ? <p className="mt-1 font-mono text-xs text-muted-foreground">{tool.barcode}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  const { workspace, upsertTool, deleteTool } = useStore();
  const tools = workspace.tools;
  const locations = workspace.locations;
  const [editing, setEditing] = useState<Partial<Tool> | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState(locations[0]?.id || "");

  const grouped = useMemo(() => {
    const byLocation = locations.map((location) => ({
      location,
      tools: tools.filter((tool) => tool.assigned_location_id === location.id),
    }));
    const unassigned = tools.filter(
      (tool) => !locations.some((location) => location.id === tool.assigned_location_id),
    );
    const employees = Array.from(
      new Set(
        [
          ...locations.map((location) => location.assigned_to || ""),
          ...tools.map((tool) => tool.assigned_to || ""),
        ].filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return { byLocation, unassigned, employees };
  }, [locations, tools]);

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

  const remove = async (id: string) => {
    const result = await deleteTool(id);
    if (!result.ok) {
      toast.error(result.error || "Could not delete that tool.");
      return;
    }
    toast.success("Tool removed");
  };

  const startAdd = (locationId?: string) => {
    const assigned = locationId || locations[0]?.id || "";
    setDefaultLocationId(assigned);
    setEditing({
      ...emptyTool,
      assigned_location_id: assigned,
      assigned_to: locations.find((row) => row.id === assigned)?.assigned_to || "",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tools"
        description="Every warehouse, vehicle, and assigned employee with the tools on that assignment"
        icon={<Wrench className="size-7 text-primary" />}
        actions={
          <Button onClick={() => startAdd()}>
            <Plus className="mr-2 size-4" />
            Add tool
          </Button>
        }
      />

      {locations.length === 0 && tools.length === 0 ? (
        <EmptyState
          icon={<Wrench className="size-12" />}
          title="No locations or tools yet"
          description="Add a warehouse or vehicle first, then assign tools to it."
        />
      ) : (
        <div className="space-y-6">
          {grouped.employees.length ? (
            <div className="flex flex-wrap gap-2">
              {grouped.employees.map((name) => (
                <Badge key={name} variant="outline" className="gap-1">
                  <UserRound className="size-3.5" />
                  {name}
                  <span className="text-muted-foreground">
                    {tools.filter((tool) => tool.assigned_to === name).length} tool
                    {tools.filter((tool) => tool.assigned_to === name).length === 1 ? "" : "s"}
                  </span>
                </Badge>
              ))}
            </div>
          ) : null}

          {grouped.byLocation.map(({ location, tools: assigned }) => (
            <Card key={location.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {location.type === "vehicle" ? (
                      <Truck className="size-4 text-primary" />
                    ) : (
                      <Warehouse className="size-4 text-primary" />
                    )}
                    {location.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {location.type === "vehicle" ? "Vehicle" : "Warehouse"}
                    {location.assigned_to ? ` · Employee ${location.assigned_to}` : ""}
                    {` · ${assigned.length} tool${assigned.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => startAdd(location.id)}>
                  <Plus className="mr-1 size-3.5" />
                  Add tool
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {assigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tools assigned to this location.</p>
                ) : (
                  assigned.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      onEdit={() => setEditing(tool)}
                      onDelete={() => void remove(tool.id)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          ))}

          {grouped.unassigned.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Unassigned tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped.unassigned.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onEdit={() => setEditing(tool)}
                    onDelete={() => void remove(tool.id)}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
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
                  value={editing.assigned_location_id || defaultLocationId}
                  onValueChange={(value) =>
                    setEditing({
                      ...editing,
                      assigned_location_id: value,
                      assigned_to: editing.assigned_to || locations.find((row) => row.id === value)?.assigned_to || "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Warehouse or vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {locationLabel(location)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Assigned employee</Label>
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
              <Button className="w-full" onClick={save}>
                Save tool
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
