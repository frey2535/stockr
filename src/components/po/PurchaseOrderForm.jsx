import React, { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PurchaseOrderForm({ open, onClose, onSave, materials }) {
  const [poNumber, setPoNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const addLine = () => setLines(l => [...l, { material_id: "", material_name: "", expected_quantity: 1, unit_cost: 0 }]);

  const updateLine = (idx, field, value) => {
    setLines(prev => prev.map((ln, i) => {
      if (i !== idx) return ln;
      const next = { ...ln, [field]: value };
      if (field === "material_id") {
        const m = materials.find(mm => mm.id === value);
        next.material_name = m?.name || "";
        if (m?.unit_cost) next.unit_cost = m.unit_cost;
      }
      return next;
    }));
  };

  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!poNumber) return;
    const validLines = lines.filter(l => l.material_id && l.expected_quantity > 0);
    if (validLines.length === 0) return;
    setSaving(true);
    try {
      await onSave({
        po_number: poNumber,
        supplier,
        expected_delivery_date: expectedDate || null,
        notes,
        status: "ordered",
        lines: validLines,
      });
      // reset
      setPoNumber(""); setSupplier(""); setExpectedDate(""); setNotes(""); setLines([]);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setPoNumber(""); setSupplier(""); setExpectedDate(""); setNotes(""); setLines([]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">PO Number *</Label>
              <Input value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="e.g. PO-2601-001" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Supplier</Label>
              <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Crescent Electric" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Expected Delivery</Label>
            <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          </div>

          {/* Lines */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Line
              </Button>
            </div>
            {lines.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No lines yet — click "Add Line" to add materials.</p>
            )}
            {lines.map((ln, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 border rounded-lg">
                <div className="flex-1 min-w-0 space-y-1">
                  <Select value={ln.material_id} onValueChange={v => updateLine(idx, "material_id", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select material" /></SelectTrigger>
                    <SelectContent>
                      {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1">
                    <Input type="number" min="1" value={ln.expected_quantity} onChange={e => updateLine(idx, "expected_quantity", parseFloat(e.target.value) || 0)} placeholder="Qty" className="h-8 text-xs w-20" />
                    <Input type="number" step="0.01" value={ln.unit_cost} onChange={e => updateLine(idx, "unit_cost", parseFloat(e.target.value) || 0)} placeholder="Unit cost" className="h-8 text-xs flex-1" />
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => removeLine(idx)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={close} className="mr-auto">Cancel</Button>
            <Button
              size="sm"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              onClick={handleSave}
              disabled={saving || !poNumber || lines.filter(l => l.material_id && l.expected_quantity > 0).length === 0}
            >
              <Check className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Create PO"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}