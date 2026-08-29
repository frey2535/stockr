import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { useUserCompanyId } from "@/lib/useUserCompanyId";
import CompanyAccessGate from "@/components/CompanyAccessGate";
import { Warehouse, Truck, Plus, Trash2, Edit2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Locations() {
  const { user } = useAuth();
  const { activeCompanyId } = useUserCompanyId();
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form, setForm] = useState({ name: "", type: "vehicle", description: "", assigned_to: "" });
  const queryClient = useQueryClient();

  const { data: settingsList = [] } = useQuery({
    queryKey: ["appSettings", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.AppSettings.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
    staleTime: 60000,
  });
  const companyLogo = settingsList[0]?.logo_url;

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.Location.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["inventoryItems", activeCompanyId],
    queryFn: () => activeCompanyId ? base44.entities.InventoryItem.filter({ company_id: activeCompanyId }) : Promise.resolve([]),
    enabled: !!activeCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Location.create({ ...data, company_id: activeCompanyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", activeCompanyId] });
      resetForm();
      toast.success("Location added");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Location.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", activeCompanyId] });
      resetForm();
      toast.success("Location updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Location.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations", activeCompanyId] });
      toast.success("Location deleted");
    },
  });

  const resetForm = () => {
    setForm({ name: "", type: "vehicle", description: "", assigned_to: "" });
    setEditingLocation(null);
    setShowForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (loc) => {
    setForm({ name: loc.name, type: loc.type, description: loc.description || "", assigned_to: loc.assigned_to || "" });
    setEditingLocation(loc);
    setShowForm(true);
  };

  const warehouses = locations.filter((l) => l.type === "warehouse");
  const vehicles = locations.filter((l) => l.type === "vehicle");

  const getItemCount = (locId) => {
    const items = inventoryItems.filter((i) => i.location_id === locId);
    return items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const locationsContent = (
    <div className="space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground mt-1">Manage your warehouses and vehicles</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {companyLogo && (
            <img src={companyLogo} alt="Company Logo" className="h-14 w-auto max-w-[200px] object-contain" />
          )}
          <Button onClick={() => setShowForm(true)} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      {/* Warehouses */}
      {warehouses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-primary" />
            Warehouses
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {warehouses.map((loc) => (
              <Card key={loc.id} className="group hover:shadow-lg transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Warehouse className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{loc.name}</h3>
                        {loc.description && <p className="text-xs text-muted-foreground">{loc.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(loc)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(loc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground text-lg">{getItemCount(loc.id)}</span>
                    <span>items in stock</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Vehicles */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="w-5 h-5 text-secondary" />
          Vehicles
        </h2>
        {vehicles.length === 0 ? (
          <Card className="p-8 text-center">
            <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No vehicles added yet</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {vehicles.map((loc) => (
              <Card key={loc.id} className="group hover:shadow-lg transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center">
                        <Truck className="w-6 h-6 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{loc.name}</h3>
                        {loc.assigned_to && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {loc.assigned_to}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(loc)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(loc.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground text-lg">{getItemCount(loc.id)}</span>
                    <span>items loaded</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={resetForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Main Warehouse, Truck #3"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
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
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
            {form.type === "vehicle" && (
              <div className="space-y-2">
                <Label>Assigned To (optional)</Label>
                <Input
                  value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  placeholder="Driver / technician name"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              <Button type="submit" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                {editingLocation ? "Update" : "Add Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (!user) return null;

  return (
    <CompanyAccessGate userEmail={user.email}>
      {locationsContent}
    </CompanyAccessGate>
  );
}