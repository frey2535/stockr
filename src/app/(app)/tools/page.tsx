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
import { nextToolNumber, TOOL_CONDITIONS, toolConditionLabel } from "@/lib/tools-state";
import type { Location, Tool, ToolCondition, ToolStatus } from "@/lib/types";

const STATUS: Record<ToolStatus, string> = {
  available: "bg-green-100 text-green-700",
  checked_out: "bg-orange-100 text-orange-700",
  maintenance: "bg-gray-100 text-gray-700",
};

const CONDITION: Record<ToolCondition, string> = {
  good: "bg-green-100 text-green-800",
  operating_issues: "bg-amber-100 text-amber-800",
  broken: "bg-red-100 text-red-800",
  lost: "bg-slate-100 text-slate-800",
  stolen: "bg-slate-200 text-slate-900",
  in_repair: "bg-orange-100 text-orange-800",
  retired: "bg-gray-100 text-gray-700",
};

const emptyTool: Partial<Tool> = {
  name: "",
  category: "",
  barcode: "",
  tool_number: "",
  assigned_to: "",
  status: "available",
  condition: "good",
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
  const condition = (tool.condition || "good") as ToolCondition;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border bg-background p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {tool.tool_number ? (
            <Badge variant="outline" className="font-mono">
              #{tool.tool_number}
            </Badge>
          ) : null}
          <h4 className="font-medium">{tool.name}</h4>
          <Badge className={CONDITION[condition] || CONDITION.good}>{toolConditionLabel(condition)}</Badge>
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
  const { workspace, account, upsertTool, deleteTool } = useStore();
  const tools = workspace.tools;
  const locations = workspace.locations;
  const [editing, setEditing] = useState<Partial<Tool> | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState(locations[0]?.id || "");
  const [customEmployee, setCustomEmployee] = useState(false);

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
          ...(account?.members || []).map((member) => member.name || ""),
          ...locations.map((location) => location.assigned_to || ""),
          ...tools.map((tool) => tool.assigned_to || ""),
        ].filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    const toolNumbers = Array.from(
      new Set(tools.map((tool) => String(tool.tool_number || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { byLocation, unassigned, employees, toolNumbers };
  }, [account?.members, locations, tools]);

  const save = async () => {
    if (!editing?.name?.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!editing.assigned_location_id && !editing.assigned_to?.trim()) {
      toast.error("Assign the tool to an employee or a warehouse/vehicle.");
      return;
    }
    const result = await upsertTool({
      ...editing,
      tool_number: editing.tool_number?.trim() || nextToolNumber(tools),
      condition: editing.condition || "good",
      assigned_to: editing.assigned_to?.trim() || "",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editing.assigned_to?.trim() ? `Tool assigned to ${editing.assigned_to.trim()}` : "Tool saved");
    setEditing(null);
    setCustomEmployee(false);
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
    setCustomEmployee(false);
    setEditing({
      ...emptyTool,
      tool_number: nextToolNumber(tools),
      assigned_location_id: assigned,
      assigned_to: locations.find((row) => row.id === assigned)?.assigned_to || "",
    });
  };

  const employeeValue = customEmployee ? "__other__" : editing?.assigned_to?.trim() || "__none__";

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
          title="No tools yet"
          description="Add a tool and assign it to an employee, warehouse, or vehicle."
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

          {grouped.employees.map((name) => {
            const assigned = tools.filter((tool) => tool.assigned_to === name);
            if (!assigned.length) return null;
            return (
              <Card key={`emp-${name}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserRound className="size-4 text-primary" />
                    {name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {assigned.length} assigned tool{assigned.length === 1 ? "" : "s"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {assigned.map((tool) => (
                    <ToolCard
                      key={tool.id}
                      tool={tool}
                      onEdit={() => {
                        setCustomEmployee(false);
                        setEditing(tool);
                      }}
                      onDelete={() => void remove(tool.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}

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
                      onEdit={() => {
                        setCustomEmployee(false);
                        setEditing(tool);
                      }}
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
                <CardTitle className="text-base">Unassigned location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped.unassigned.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    onEdit={() => {
                      setCustomEmployee(false);
                      setEditing(tool);
                    }}
                    onDelete={() => void remove(tool.id)}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCustomEmployee(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                  <Label className="text-xs">Tool #</Label>
                  <Select
                    value={editing.tool_number && grouped.toolNumbers.includes(editing.tool_number) ? editing.tool_number : "__custom__"}
                    onValueChange={(value) =>
                      setEditing({
                        ...editing,
                        tool_number: value === "__custom__" ? nextToolNumber(tools) : value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tool #" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">New tool #</SelectItem>
                      {grouped.toolNumbers.map((number) => (
                        <SelectItem key={number} value={number}>
                          {number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="mt-2 font-mono"
                    value={editing.tool_number || ""}
                    onChange={(event) => setEditing({ ...editing, tool_number: event.target.value })}
                    placeholder="T-001"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Condition</Label>
                  <Select
                    value={editing.condition || "good"}
                    onValueChange={(value) => setEditing({ ...editing, condition: value as ToolCondition })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOL_CONDITIONS.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                <Label className="text-xs">Assigned employee</Label>
                <Select
                  value={employeeValue}
                  onValueChange={(value) => {
                    if (value === "__other__") {
                      setCustomEmployee(true);
                      setEditing({ ...editing, assigned_to: "" });
                      return;
                    }
                    setCustomEmployee(false);
                    if (value === "__none__") {
                      setEditing({ ...editing, assigned_to: "" });
                      return;
                    }
                    const location = locations.find((row) => row.assigned_to === value);
                    setEditing({
                      ...editing,
                      assigned_to: value,
                      assigned_location_id:
                        editing.assigned_location_id || location?.id || editing.assigned_location_id,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {grouped.employees.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">Someone else…</SelectItem>
                  </SelectContent>
                </Select>
                {customEmployee || (editing.assigned_to && !grouped.employees.includes(editing.assigned_to)) ? (
                  <Input
                    className="mt-2"
                    value={editing.assigned_to || ""}
                    onChange={(event) => setEditing({ ...editing, assigned_to: event.target.value })}
                    placeholder="Crew member name"
                  />
                ) : null}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned location</Label>
                <Select
                  value={editing.assigned_location_id || defaultLocationId || "__none__"}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      setEditing({ ...editing, assigned_location_id: "" });
                      return;
                    }
                    setEditing({
                      ...editing,
                      assigned_location_id: value,
                      assigned_to: editing.assigned_to || locations.find((row) => row.id === value)?.assigned_to || "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Warehouse or vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No location yet</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {locationLabel(location)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Button className="w-full" onClick={() => void save()}>
                Save tool
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
