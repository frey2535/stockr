import React, { useState, useMemo } from "react";
import { Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ReceivePODialog({ open, po, locations, activeCompanyId, onClose, onReceived }) {
  const [received, setReceived] = useState({});
  const [toLocationId, setToLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const lines = po?.lines || [];

  const lineStatus = useMemo(() => lines.map(l => {
    const expected = l.expected_quantity || 0;
    const already = l.received_quantity || 0;
    const now = received[l.material_id] || 0;
    const remaining = expected - already;
    return { ...l, already, remaining, now };
  }), [lines, received]);

  const handleReceive = async () => {
    if (!toLocationId) { toast.error("Select a destination location"); return; }
    const receivedLines = lineStatus
      .map((l, idx) => ({ lineIndex: idx, receivedQuantity: Number(l.now) || 0 }))
      .filter(r => r.receivedQuantity > 0);
    if (receivedLines.length === 0) { toast.error("Enter a quantity to receive"); return; }

    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("receivePurchaseOrder", {
        purchaseOrderId: po.id,
        receivedLines,
        toLocationId,
        company_id: activeCompanyId,
      });
      if (res?.data?.error) {
        toast.error(res.data.error.message || "Receive failed");
        return;
      }
      toast.success(`Received ${res.data?.totalReceived || 0} unit(s) — PO is now ${res.data?.status || "updated"}`);
      setReceived({});
      setToLocationId("");
      onReceived();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Receive failed");
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setReceived({});
    setToLocationId("");
    onClose();
  };

  if (!po) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && close()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Receive PO <span className="text-sm font-normal text-muted-foreground">{po.po_number}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Receive Into Location *</Label>
            <Select value={toLocationId} onValueChange={setToLocationId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.type === "warehouse" ? "🏭" : "🚛"} {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 pt-1">
            <Label className="text-xs">Line Items</Label>
            {lineStatus.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.material_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">
                    Expected: {l.expected_quantity} · Already received: {l.already}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {l.remaining <= 0 && l.expected_quantity > 0 && (
                    <Badge className="bg-green-100 text-green-700 text-xs">Done</Badge>
                  )}
                  <Input
                    type="number"
                    min="0"
                    value={received[l.material_id] ?? ""}
                    onChange={e => setReceived(prev => ({ ...prev, [l.material_id]: e.target.value }))}
                    placeholder="0"
                    className="h-8 w-16 text-sm text-center"
                    disabled={l.remaining <= 0}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={close} className="mr-auto">Cancel</Button>
            <Button
              size="sm"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              onClick={handleReceive}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Confirm Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}