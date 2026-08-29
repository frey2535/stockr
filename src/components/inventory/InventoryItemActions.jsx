import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Edit2, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function InventoryItemActions({ material, inventoryItems, locations, activeCompanyId }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(inventoryItems.map(i => ({ ...i })));
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!confirm(`Delete all inventory for "${material.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(inventoryItems.map(item => base44.entities.InventoryItem.delete(item.id)));
      queryClient.invalidateQueries({ queryKey: ["inventoryItems", activeCompanyId] });
      toast.success(`Deleted ${material.name}`);
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Separate updates and deletes
      const updates = editData.filter(item => item.quantity > 0);
      const deletes = editData.filter(item => item.quantity === 0);

      // Update non-zero items
      if (updates.length > 0) {
        await Promise.all(
          updates.map(item => base44.entities.InventoryItem.update(item.id, { quantity: item.quantity }))
        );
      }

      // Delete zero-quantity items
      if (deletes.length > 0) {
        await Promise.all(
          deletes.map(item => base44.entities.InventoryItem.delete(item.id))
        );
      }

      // Invalidate all affected queries to sync across app
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setEditOpen(false);
      toast.success("Quantities updated");
    } catch (err) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (editOpen) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-muted rounded-lg" onClick={e => e.stopPropagation()}>
        <div className="text-xs font-semibold text-muted-foreground">Edit Quantities:</div>
        {editData.map((item, idx) => {
          const loc = locations.find(l => l.id === item.location_id);
          return (
            <div key={item.id} className="flex items-center gap-2">
              <span className="text-xs min-w-32 truncate">{loc?.name}</span>
              <Input
                type="number"
                min="0"
                value={item.quantity}
                onChange={e => {
                  e.stopPropagation();
                  const updated = [...editData];
                  updated[idx].quantity = Math.max(0, parseInt(e.target.value) || 0);
                  setEditData(updated);
                }}
                onClick={e => e.stopPropagation()}
                className="h-8 w-20 text-sm"
              />
            </div>
          );
        })}
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setEditOpen(false); }} disabled={saving}>
            <X className="w-3 h-3 mr-1" /> Cancel
          </Button>
          <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={e => { e.stopPropagation(); handleSave(); }} disabled={saving}>
            <Save className="w-3 h-3 mr-1" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted">
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditOpen(true); }}>
          <Edit2 className="w-3.5 h-3.5 mr-2" />
          Edit Quantity
        </DropdownMenuItem>
        <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting} className="text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}