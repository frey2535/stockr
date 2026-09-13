"use client";

import { useState } from "react";
import { MapPin, Plus, Truck, Warehouse } from "lucide-react";
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
  DialogFooter,
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
import { useApi } from "@/lib/use-api";
import { qty } from "@/lib/format";
import type { Location, LocationType } from "@/lib/types";
import type { DashboardPayload } from "@/lib/workspace-types";

const emptyForm = {
  name: "",
  type: "warehouse" as LocationType,
  description: "",
  assigned_to: "",
};

export default function LocationsPage() {
  const { workspace, upsertLocation, deleteLocation } = useStore();
  const { settings, locations } = workspace;
  const { data: dash } = useApi<DashboardPayload>("/api/dashboard");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState(emptyForm);

  const warehouses = locations.filter((row) => row.type === "warehouse");
  const vehicles = locations.filter((row) => row.type === "vehicle");

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const startEdit = (location: Location) => {
    setEditing(location);
    setForm({
      name: location.name,
      type: location.type,
      description: location.description || "",
      assigned_to: location.assigned_to || "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const result = await upsertLocation({
      id: editing?.id,
      ...form,
    });
    if (!result.ok) {
      toast.error(result.error || "Could not save location.");
      return;
    }
    toast.success(editing ? "Location updated" : "Location added");
    setOpen(false);
  };

  const LocationCard = ({ location }: { location: Location }) => {
    const stats = dash?.locations.find((row) => row.id === location.id);
    const rows = stats?.materialCount || 0;
    const units = stats?.units || 0;
    return (
      <Card className="transition-all hover:shadow-lg">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={
                  location.type === "warehouse"
                    ? "flex size-10 items-center justify-center rounded-lg bg-primary/10"
                    : "flex size-10 items-center justify-center rounded-lg bg-secondary/10"
                }
              >
                {location.type === "warehouse" ? (
                  <Warehouse className="size-5 text-primary" />
                ) : (
                  <Truck className="size-5 text-secondary" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{location.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {location.assigned_to || location.description || (location.type === "warehouse" ? "Warehouse" : "Vehicle")}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {rows} materials · {qty(units)} on hand
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startEdit(location)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  deleteLocation(location.id);
                  toast.success("Location removed");
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locations"
        description="Manage your warehouses and vehicles"
        actions={
          <>
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
            ) : null}
            <Button onClick={startCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="mr-2 size-4" />
              Add Location
            </Button>
          </>
        }
      />

      {locations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-12" />}
          title="No locations yet. Add a warehouse or vehicle to get started."
          action={
            <Button onClick={startCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              Add Location
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {warehouses.length > 0 ? (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Warehouse className="size-5 text-primary" />
                Warehouses
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {warehouses.map((location) => (
                  <LocationCard key={location.id} location={location} />
                ))}
              </div>
            </section>
          ) : null}
          {vehicles.length > 0 ? (
            <section className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Truck className="size-5 text-secondary" />
                Vehicles
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                {vehicles.map((location) => (
                  <LocationCard key={location.id} location={location} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Main Warehouse, Truck #3"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) => setForm({ ...form, type: value as LocationType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Additional details..."
              />
            </div>
            {form.type === "vehicle" ? (
              <div className="space-y-2">
                <Label>Assigned To (optional)</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
                  placeholder="Driver / technician name"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={save}>
              {editing ? "Update" : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
